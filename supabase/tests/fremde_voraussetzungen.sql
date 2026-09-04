-- Testvorrichtung: die fremden Objekte, die der VSM Builder voraussetzt.
--
-- **Keine Migration.** Diese Datei gehoert nicht in `migrations/` und wird
-- nie gegen die Produktion ausgefuehrt. Sie existiert einzig, damit sich der
-- Tabellen-Baseline auf einer leeren Datenbank pruefen laesst — was
-- supabase/README.md verlangt: "Ein Baseline, der nie auf einer leeren
-- Datenbank lief, ist eine Vermutung."
--
-- Nachgebildet werden nur die Beruehrungspunkte, nicht die Tabellen selbst:
-- `organizations.id` und `auth.users.id`, weil Fremdschluessel dorthin
-- zeigen, `organization_members` und `has_org_role()`, weil die Policies der
-- Autorisierungsschicht sie aufrufen. Die echten Definitionen liegen in den
-- Prisma-Migrationen von LeanPulse Industrial; wer sie hier nachschlaegt,
-- liest die falsche Quelle.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid,
  role            text
);

-- auth.uid() liefert produktiv die Id aus dem JWT.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULL::uuid $$;

-- Die echte Funktion prueft die Rangfolge viewer < editor < admin. Fuer den
-- Baseline-Test genuegt, dass sie existiert und die richtige Signatur hat:
-- geprueft wird das Schema, nicht die Berechtigungslogik.
CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, p_min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_org_id AND m.user_id = auth.uid()
  );
$$;

-- Supabase legt diese Rollen an; die GRANTs der Autorisierungsschicht
-- brauchen sie.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;
