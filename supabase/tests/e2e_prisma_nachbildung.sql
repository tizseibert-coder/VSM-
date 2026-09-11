-- Testvorrichtung fuer die Browsertests: die Prisma-Objekte, die die
-- *Anwendung* zum Laufen braucht.
--
-- **Keine Migration.** Diese Datei gehoert nicht in `migrations/` und laeuft
-- nie gegen die Produktion. Sie ist der zweite Riegel neben
-- `fremde_voraussetzungen.sql` — und der Unterschied zwischen beiden ist der
-- Zweck, nicht der Umfang:
--
--   fremde_voraussetzungen.sql  bildet Beruehrungspunkte nach, damit sich der
--                               Tabellen-Baseline auf einer leeren Datenbank
--                               *pruefen* laesst. Schema, nicht Verhalten.
--   diese Datei                 bildet genug nach, damit die Anwendung gegen
--                               eine lokale Supabase-Instanz *laeuft*:
--                               angemeldet, mit Zeilensicherheit.
--
-- Sie ueberschreibt bewusst *nichts*, was die echte Instanz mitbringt —
-- `auth.users` und `auth.uid()` kommen von GoTrue und bleiben unangetastet.
-- Ein zweiter Trigger auf `auth.users` waere genau die Konstellation vom
-- 16.08., die supabase/README.md beschreibt.
--
-- Die echten Definitionen liegen in den Prisma-Migrationen von LeanPulse
-- Industrial. Wer sie hier nachschlaegt, liest die falsche Quelle. Was hier
-- steht, ist eine Nachbildung, und die Tests darueber beweisen nichts ueber
-- das Verhalten der echten Funktion — nur ueber das der Anwendung gegen
-- diese.

-- ═══════════════════════════════════════════
-- Die drei Tabellen, die Taktane liest
-- ═══════════════════════════════════════════
-- Nachgebildet werden die Spalten, die die Anwendung tatsaechlich abfragt:
-- activeOrg.ts liest `role, organization_id` und `id, name`,
-- entitlement.ts liest `tier, status, granted_at` mit product='VSM_BUILDER'.

CREATE TABLE IF NOT EXISTS public.organizations (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'viewer',
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_entitlements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product         text NOT NULL,
  tier            text NOT NULL,
  status          text NOT NULL DEFAULT 'ACTIVE',
  granted_at      timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- has_org_role — mit echter Rangfolge
-- ═══════════════════════════════════════════
-- Jede Policy der Autorisierungsschicht ruft sie auf. Die Attrappe in
-- fremde_voraussetzungen.sql prueft nur "ist ueberhaupt Mitglied" — das
-- genuegt dort, weil dort das Schema geprueft wird und nicht die Anwendung.
-- Hier waere dieselbe Vereinfachung schaedlich: Sie faerbte Tests gruen, wo
-- die Produktion ablehnt. Ein Betrachter darf lesen und nicht schreiben, und
-- genau das soll pruefbar sein.
--
-- viewer < editor < admin. Eine unbekannte Rolle zaehlt als niedrigste
-- (0) und eine unbekannte Mindestrolle als hoechste — im Zweifel ablehnen.
CREATE OR REPLACE FUNCTION public.org_role_rank(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_role, ''))
    WHEN 'viewer' THEN 1
    WHEN 'editor' THEN 2
    WHEN 'admin'  THEN 3
    WHEN 'owner'  THEN 3
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, p_min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND public.org_role_rank(m.role) >= GREATEST(public.org_role_rank(p_min_role), 1)
  );
$$;

-- ═══════════════════════════════════════════
-- Zeilensicherheit auf den drei Tabellen
-- ═══════════════════════════════════════════
-- Ohne sie liefert PostgREST dem angemeldeten Nutzer nichts, und das
-- Dashboard bliebe leer — der Test saehe eine leere Seite und koennte nicht
-- unterscheiden, ob das Layout oder die Abfrage kaputt ist.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view their organizations" ON public.organizations;
CREATE POLICY "members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (has_org_role(id, 'viewer'));

DROP POLICY IF EXISTS "members can view their own memberships" ON public.organization_members;
CREATE POLICY "members can view their own memberships"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "members can view their entitlements" ON public.organization_entitlements;
CREATE POLICY "members can view their entitlements"
  ON public.organization_entitlements FOR SELECT
  TO authenticated
  USING (has_org_role(organization_id, 'viewer'));

GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
GRANT SELECT ON public.organization_entitlements TO authenticated;
