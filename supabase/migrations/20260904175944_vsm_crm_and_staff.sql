-- Vertriebsschicht des VSM Builders: Interessenten, ihre Chronik, und wer sie
-- sehen darf (2026-09-04)
--
-- Bis hierher endete die Kette bei der Registrierung: Wer sich anmeldete,
-- bekam ueber `handle_new_user()` eine Organisation und war ab da ein Nutzer
-- wie jeder andere. Was davor lag — woher jemand kam, worauf er geklickt hat,
-- ob ihn schon einmal jemand angerufen hat — stand nirgends. Diese Migration
-- legt genau das an, und zwar so, dass es die Eigentuemergrenze aus
-- supabase/README.md nicht anfasst.
--
-- ─────────────────────────────────────────────────────────────────────
-- Was hier NICHT steht, und warum
-- ─────────────────────────────────────────────────────────────────────
-- Kein eigener Tarif. `organization_entitlements` (Prisma / LeanPulse
-- Industrial) traegt seit dem gemeinsamen Login je Organisation und Produkt
-- (`AppProduct`) eine Stufe aus `Tier` — FREE, BETA, STARTER, PROFESSIONAL,
-- ENTERPRISE. Das ist das Freemium-Rueckgrat aller drei Produkte. Eine zweite
-- Tabelle daneben waere eine zweite Wahrheit: zwei Stellen, an denen "der
-- Kunde ist auf PROFESSIONAL" steht, und irgendwann widersprechen sie sich.
-- Der VSM Builder liest die vorhandene Tabelle (siehe
-- src/lib/billing/entitlement.ts) und leitet seine Grenzen daraus ab.
--
-- Kein Spiegel von `auth.users`. Eine `profiles`-Tabelle braeuchte einen
-- Trigger auf `auth.users` — dort haengt schon `handle_new_user()` von
-- Prisma, und ein zweiter Trigger auf einer fremden Tabelle ist genau die
-- Konstellation vom 16.08. Die E-Mail-Adressen holt der Verwaltungsbereich
-- serverseitig ueber die Admin-API (src/lib/supabase/admin.ts), nicht ueber
-- PostgREST.
--
-- Kein oeffentliches INSERT auf `vsm_leads`. Das Formular auf der
-- Verkaufsseite schreibt nicht als `anon`, sondern ueber eine Server Action
-- mit Service-Role. Eine Policy `TO anon WITH CHECK (true)` waere ein offenes
-- Schreibrecht auf eine Tabelle mit personenbezogenen Daten — jeder mit dem
-- publishable key koennte sie fuellen.
--
-- Idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` durchgehend).

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'Die Vertriebsschicht setzt public.organizations voraus (Eigentuemer: Prisma / LeanPulse Industrial). Zuerst `prisma migrate deploy` aus apps/api laufen lassen. Siehe supabase/README.md.';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION
      'Die Vertriebsschicht setzt auth.users voraus (Eigentuemer: Supabase).';
  END IF;
END
$$;

-- ═══════════════════════════════════════════
-- 1) vsm_staff — wer den Verwaltungsbereich sehen darf
-- ═══════════════════════════════════════════
-- Das ist *nicht* die Rolle innerhalb einer Organisation (die steht in
-- `organization_members.role` und heisst owner/editor/viewer). Hier geht es um
-- die Betreiberseite: Wer den Bestand ueber alle Organisationen hinweg sieht.
-- Zwei Stufen, weil sie sich in dem unterscheiden, was am meisten weh tut:
--
--   sales — sieht Interessenten und Nutzer, pflegt die Chronik
--   admin — zusaetzlich Tarifvergabe
--
-- Eingetragen wird hier nicht ueber die Oberflaeche, sondern von Hand (siehe
-- supabase/README.md, "Den ersten Betreiber eintragen"). Eine Oberflaeche, die
-- ihre eigenen Zugangsrechte vergibt, braucht einen ersten Eintrag, der von
-- aussen kommt — und dann braucht sie die Oberflaeche dafuer nicht mehr.
CREATE TABLE IF NOT EXISTS public.vsm_staff (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'sales',
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsm_staff_role_check CHECK (role = ANY (ARRAY['admin'::text, 'sales'::text]))
);

COMMENT ON TABLE public.vsm_staff IS
  'Betreiberseitige Rollen des VSM Builders (Vertrieb/Verwaltung), unabhaengig von organization_members. Eintraege werden von Hand gesetzt, nicht ueber die Oberflaeche.';

-- SECURITY DEFINER, damit die Auswertung nicht selbst an der RLS von
-- `vsm_staff` haengt — sonst braeuchte die Policy auf vsm_staff eine Policy auf
-- vsm_staff. Dasselbe Muster wie `project_org_id()`.
CREATE OR REPLACE FUNCTION public.is_vsm_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (select 1 from public.vsm_staff where user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_vsm_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.vsm_staff where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ═══════════════════════════════════════════
-- 2) vsm_leads — der Interessent
-- ═══════════════════════════════════════════
-- Eine Zeile je Person, nicht je Kontaktaufnahme: Wer das Formular zweimal
-- ausfuellt, ist nicht zwei Interessenten. Die Eindeutigkeit laeuft ueber die
-- kleingeschriebene Adresse, weil "Max.Muster@firma.de" und
-- "max.muster@firma.de" dieselbe Person sind — ein UNIQUE auf der rohen Spalte
-- wuerde das nicht bemerken.
--
-- `organization_id` und `user_id` sind der Uebergang: Solange sie leer sind,
-- ist das ein Interessent; sobald sich jemand registriert, traegt sie die
-- Signup-Action nach und aus dem Interessenten wird ein Nutzer, dessen
-- Vorgeschichte erhalten bleibt.
CREATE TABLE IF NOT EXISTS public.vsm_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  full_name       text,
  company         text,
  job_title       text,
  phone           text,
  locale          text,
  -- Die Stufen des Trichters. 'trial' heisst registriert und am Ausprobieren,
  -- 'customer' heisst zahlender Tarif — den Uebergang setzt die Tarifvergabe
  -- im Verwaltungsbereich, nicht der Vertrieb von Hand.
  stage           text NOT NULL DEFAULT 'new',
  -- Woher der Eintrag stammt (welches Formular), nicht zu verwechseln mit
  -- `utm_source` (welche Kampagne).
  source          text NOT NULL DEFAULT 'website',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_term        text,
  utm_content     text,
  referrer        text,
  landing_path    text,
  message         text,
  -- DSGVO: Nicht nur *dass* eingewilligt wurde, sondern der Wortlaut, dem
  -- zugestimmt wurde. Ein spaeter geaenderter Formulartext macht sonst jede
  -- alte Einwilligung unbelegbar.
  consent_at      timestamptz,
  consent_text    text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsm_leads_stage_check CHECK (stage = ANY (ARRAY[
    'new'::text, 'contacted'::text, 'qualified'::text,
    'trial'::text, 'customer'::text, 'lost'::text
  ])),
  CONSTRAINT vsm_leads_email_not_blank CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS vsm_leads_email_lower_key
  ON public.vsm_leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_vsm_leads_stage ON public.vsm_leads USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_vsm_leads_created_at ON public.vsm_leads USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vsm_leads_owner_user_id ON public.vsm_leads USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vsm_leads_organization_id ON public.vsm_leads USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_vsm_leads_user_id ON public.vsm_leads USING btree (user_id);

COMMENT ON COLUMN public.vsm_leads.consent_text IS
  'Der Wortlaut der Einwilligung zum Zeitpunkt der Abgabe. Ohne ihn ist eine Einwilligung nach spaeteren Textaenderungen nicht mehr belegbar.';

-- ═══════════════════════════════════════════
-- 3) vsm_lead_events — die Chronik
-- ═══════════════════════════════════════════
-- Anfuegend, nicht aenderbar — dieselbe Linie wie `activity_logs`: Ein
-- Gespraechsprotokoll, das man nachtraeglich glattziehen kann, ist als Beleg
-- wertlos. Wer sich vertippt hat, schreibt eine Berichtigung darunter.
--
-- Systemereignisse (Registrierung, erstes Projekt) und Handnotizen liegen
-- bewusst in derselben Tabelle: Der Vertrieb will eine Zeitleiste lesen, keine
-- zwei.
CREATE TABLE IF NOT EXISTS public.vsm_lead_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES public.vsm_leads(id) ON DELETE CASCADE,
  kind           text NOT NULL,
  body           text,
  payload        jsonb,
  actor_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsm_lead_events_kind_check CHECK (kind = ANY (ARRAY[
    'form'::text, 'signup'::text, 'note'::text, 'stage_change'::text,
    'owner_change'::text, 'project_created'::text, 'plan_change'::text,
    'system'::text
  ]))
);

CREATE INDEX IF NOT EXISTS idx_vsm_lead_events_lead_id
  ON public.vsm_lead_events USING btree (lead_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 4) Rechte
-- ═══════════════════════════════════════════
-- Der VSM Builder greift als `authenticated` ueber PostgREST zu. Ohne Policy
-- ist eine Tabelle mit RLS fuer ihn leer — was hier die richtige Vorgabe ist:
-- Interessentendaten gehen niemanden ausser dem Betreiber etwas an.

ALTER TABLE public.vsm_staff ENABLE ROW LEVEL SECURITY;

-- Die eigene Zeile darf jeder lesen — daran haengt die Weiche, ob der
-- Verwaltungsbereich ueberhaupt angezeigt wird. Fremde Zeilen sieht nur, wer
-- selbst Betreiber ist.
DROP POLICY IF EXISTS "staff can read own row" ON public.vsm_staff;
CREATE POLICY "staff can read own row"
  ON public.vsm_staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_vsm_staff());

-- Kein INSERT/UPDATE/DELETE ueber PostgREST, bewusst: Wer sich selbst
-- eintragen koennte, braeuchte die Tabelle nicht. Die Pflege laeuft ueber
-- Migrationen oder den Service-Role-Schluessel.

ALTER TABLE public.vsm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read leads" ON public.vsm_leads;
CREATE POLICY "staff can read leads"
  ON public.vsm_leads FOR SELECT
  TO authenticated
  USING (is_vsm_staff());

DROP POLICY IF EXISTS "staff can write leads" ON public.vsm_leads;
CREATE POLICY "staff can write leads"
  ON public.vsm_leads FOR UPDATE
  TO authenticated
  USING (is_vsm_staff())
  WITH CHECK (is_vsm_staff());

-- Kein INSERT und kein DELETE fuer `authenticated`: Angelegt wird ueber die
-- Erfassung (Service-Role), geloescht wird auf Loeschverlangen ebenfalls dort
-- — beides Vorgaenge, die protokolliert gehoeren und nicht nebenbei aus einer
-- Liste heraus passieren sollen.

ALTER TABLE public.vsm_lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read lead events" ON public.vsm_lead_events;
CREATE POLICY "staff can read lead events"
  ON public.vsm_lead_events FOR SELECT
  TO authenticated
  USING (is_vsm_staff());

-- Die Bedingung auf `actor_user_id` ist dieselbe wie bei `activity_logs`:
-- niemand schreibt einen Eintrag im Namen eines anderen. NULL bleibt erlaubt,
-- das sind die Systemereignisse aus der Erfassung (Service-Role).
DROP POLICY IF EXISTS "staff can append lead events" ON public.vsm_lead_events;
CREATE POLICY "staff can append lead events"
  ON public.vsm_lead_events FOR INSERT
  TO authenticated
  WITH CHECK (is_vsm_staff() AND actor_user_id = auth.uid());

-- ═══════════════════════════════════════════
-- 5) updated_at
-- ═══════════════════════════════════════════
-- `set_updated_at()` kommt aus 20260830160000_vsm_authorization_layer.sql.
DROP TRIGGER IF EXISTS set_vsm_leads_updated_at ON public.vsm_leads;
CREATE TRIGGER set_vsm_leads_updated_at
  BEFORE UPDATE ON public.vsm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
