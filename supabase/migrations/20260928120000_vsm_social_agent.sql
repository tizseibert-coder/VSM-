-- Social-Media-Agent: Beitraege, ihre Messwerte und das Regelwerk, das
-- daraus gelernt wird (2026-09-28)
--
-- Der Kreislauf ist Planen → Erstellen → Freigeben → Posten → Messen →
-- Lernen. Diese Migration legt die drei Tabellen an, in denen er seinen
-- Zustand haelt:
--
--   vsm_social_posts     — ein Beitrag je Zeile und Kanal, vom Entwurf bis
--                          zur Veroeffentlichung, samt den "Hebeln" (Thema,
--                          Format, Einstiegsart), nach denen spaeter
--                          ausgewertet wird
--   vsm_social_metrics   — Messpunkte je Beitrag (nach 24 h, 72 h, 7 Tagen),
--                          anfuegend, nie ueberschrieben: Der Verlauf ist die
--                          Auswertung, nicht nur der letzte Stand
--   vsm_social_playbooks — das Regelwerk, versioniert: jede Wochenanalyse
--                          ergibt eine neue Zeile, die vorherige bleibt
--                          nachlesbar
--
-- Zugriff ausschliesslich fuer Betreiber (`is_vsm_staff()`), wie bei den
-- Interessenten. Der taegliche Lauf (api/social/cron) und das Kachelbild
-- (api/social/card) schreiben bzw. lesen ueber den Service-Role-Client —
-- beide haben keinen angemeldeten Nutzer.
--
-- Idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` durchgehend).

DO $$
BEGIN
  IF to_regprocedure('public.is_vsm_staff()') IS NULL THEN
    RAISE EXCEPTION
      'Der Social-Media-Agent setzt is_vsm_staff() voraus (Migration 20260904175944_vsm_crm_and_staff).';
  END IF;
END
$$;

-- ═══════════════════════════════════════════
-- 1) vsm_social_posts
-- ═══════════════════════════════════════════
-- Ein Beitrag ist an genau einen Kanal gebunden. Derselbe Gedanke auf
-- LinkedIn und Instagram sind zwei Zeilen mit zwei Texten — ein Text, der auf
-- beiden gleich laeuft, laeuft auf keinem gut.
--
-- `topic`, `format`, `hook` sind die Hebel, nach denen ausgewertet wird. Sie
-- sind bewusst freie Texte statt CHECK-Listen: Die Liste steht in
-- src/lib/social/config.ts und wird dort erweitert, ohne Migration.
CREATE TABLE IF NOT EXISTS public.vsm_social_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel        text NOT NULL,
  -- draft → approved → publishing → published | failed; oder rejected.
  -- 'publishing' ist die Sperre gegen Doppelposts: Wer einen Beitrag
  -- postet, setzt ihn zuerst bedingt von 'approved' auf 'publishing', und
  -- nur wer dabei eine Zeile zurueckbekommt, darf weitermachen.
  status         text NOT NULL DEFAULT 'draft',
  topic          text NOT NULL,
  format         text NOT NULL,
  hook           text NOT NULL,
  -- Ob der Beitrag ein Versuch ausserhalb des Bewaehrten ist (siehe
  -- lib/social/plan.ts). Wird in der Auswertung getrennt ausgewiesen.
  explore        boolean NOT NULL DEFAULT false,
  body           text NOT NULL,
  -- Die Kachel (Bild) — Instagram braucht immer eines, LinkedIn nur beim
  -- Format 'card'.
  card_headline  text,
  card_subline   text,
  -- Warum der Agent diesen Beitrag so vorgeschlagen hat. Fuer die Freigabe:
  -- Wer weiss, was getestet wird, beurteilt einen Entwurf anders.
  rationale      text,
  scheduled_for  date NOT NULL,
  published_at   timestamptz,
  external_id    text,
  external_url   text,
  last_error     text,
  approved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsm_social_posts_channel_check CHECK (channel = ANY (ARRAY['linkedin'::text, 'instagram'::text])),
  CONSTRAINT vsm_social_posts_status_check CHECK (status = ANY (ARRAY[
    'draft'::text, 'approved'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'rejected'::text
  ]))
);

COMMENT ON TABLE public.vsm_social_posts IS
  'Beitraege des Social-Media-Agenten (Entwurf bis Veroeffentlichung) samt den Hebeln topic/format/hook fuer die Auswertung.';

CREATE INDEX IF NOT EXISTS vsm_social_posts_status_scheduled_idx
  ON public.vsm_social_posts (status, scheduled_for);
CREATE INDEX IF NOT EXISTS vsm_social_posts_channel_published_idx
  ON public.vsm_social_posts (channel, published_at DESC);

DROP TRIGGER IF EXISTS vsm_social_posts_set_updated_at ON public.vsm_social_posts;
CREATE TRIGGER vsm_social_posts_set_updated_at
  BEFORE UPDATE ON public.vsm_social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════
-- 2) vsm_social_metrics
-- ═══════════════════════════════════════════
-- `age_hours` ist das Alter des Beitrags beim Messen. Ohne diese Spalte
-- waere ein Beitrag von gestern gegen einen von letzter Woche verglichen —
-- und der aeltere gewaenne immer.
--
-- `impressions` meint bei Instagram "views" (die Plattform hat
-- "impressions" abgeschafft), bei LinkedIn `impressionCount`.
CREATE TABLE IF NOT EXISTS public.vsm_social_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES public.vsm_social_posts(id) ON DELETE CASCADE,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  age_hours    integer NOT NULL,
  impressions  integer,
  reach        integer,
  reactions    integer,
  comments     integer,
  shares       integer,
  saves        integer,
  clicks       integer,
  -- 'api' oder 'manual'. Von Hand eingetragene Werte sind genauso gueltig,
  -- aber man will sie auseinanderhalten koennen.
  source       text NOT NULL DEFAULT 'api',
  raw          jsonb,
  CONSTRAINT vsm_social_metrics_source_check CHECK (source = ANY (ARRAY['api'::text, 'manual'::text]))
);

CREATE INDEX IF NOT EXISTS vsm_social_metrics_post_idx
  ON public.vsm_social_metrics (post_id, captured_at DESC);

-- ═══════════════════════════════════════════
-- 3) vsm_social_playbooks
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vsm_social_playbooks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body           text NOT NULL,
  -- Die Kurzfassung fuer die Uebersicht: was funktioniert, was nicht, was
  -- als Naechstes getestet wird.
  summary        jsonb,
  posts_analyzed integer NOT NULL DEFAULT 0,
  -- NULL = vom taeglichen Lauf erzeugt, sonst wer den Knopf gedrueckt hat.
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vsm_social_playbooks_created_idx
  ON public.vsm_social_playbooks (created_at DESC);

-- ═══════════════════════════════════════════
-- 4) RLS — nur Betreiber
-- ═══════════════════════════════════════════
ALTER TABLE public.vsm_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vsm_social_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vsm_social_playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read social posts" ON public.vsm_social_posts;
CREATE POLICY "staff can read social posts"
  ON public.vsm_social_posts FOR SELECT
  TO authenticated
  USING (is_vsm_staff());

-- Entwuerfe bearbeiten, freigeben, verwerfen. Kein INSERT/DELETE ueber
-- PostgREST: Entwuerfe entstehen im Agenten (Service-Role), und geloescht
-- wird nichts — ein verworfener Entwurf ist fuer die Auswertung genauso
-- aufschlussreich wie ein veroeffentlichter.
DROP POLICY IF EXISTS "staff can update social posts" ON public.vsm_social_posts;
CREATE POLICY "staff can update social posts"
  ON public.vsm_social_posts FOR UPDATE
  TO authenticated
  USING (is_vsm_staff())
  WITH CHECK (is_vsm_staff());

DROP POLICY IF EXISTS "staff can read social metrics" ON public.vsm_social_metrics;
CREATE POLICY "staff can read social metrics"
  ON public.vsm_social_metrics FOR SELECT
  TO authenticated
  USING (is_vsm_staff());

-- Von Hand eingetragene Messwerte (solange ein Kanal noch ohne API laeuft).
DROP POLICY IF EXISTS "staff can add manual social metrics" ON public.vsm_social_metrics;
CREATE POLICY "staff can add manual social metrics"
  ON public.vsm_social_metrics FOR INSERT
  TO authenticated
  WITH CHECK (is_vsm_staff() AND source = 'manual');

DROP POLICY IF EXISTS "staff can read social playbooks" ON public.vsm_social_playbooks;
CREATE POLICY "staff can read social playbooks"
  ON public.vsm_social_playbooks FOR SELECT
  TO authenticated
  USING (is_vsm_staff());
