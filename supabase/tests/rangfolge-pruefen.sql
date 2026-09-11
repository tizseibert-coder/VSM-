-- Nagelt die Rangfolge der nachgebildeten has_org_role() fest.
--
-- Warum das ein eigener Test ist: `has_org_role()` gehoert Prisma, und
-- e2e_prisma_nachbildung.sql bildet sie nach. Driftet die echte Funktion,
-- bestaetigen die Browsertests darueber eine Berechtigungslogik, die es so
-- nicht gibt — und das faellt niemandem auf, weil alles gruen bleibt.
--
-- Neun Faelle: drei Rollen gegen drei Mindestrollen. Dazu die beiden
-- Randfaelle, auf die es im Zweifel ankommt.
--
-- Setzt eine Instanz voraus, deren `auth.uid()` die Ansprueche aus
-- `request.jwt.claims` liest — also eine echte Supabase-Instanz oder eine
-- Nachbildung, die sich genauso verhaelt.
--
-- Aufruf: psql "$URL" -v ON_ERROR_STOP=1 -f rangfolge-pruefen.sql

\set ON_ERROR_STOP on

DO $$
DECLARE
  org_id uuid := '11111111-1111-1111-1111-111111111111';
  nutzer uuid := '22222222-2222-2222-2222-222222222222';
  fall   record;
  ist    boolean;
BEGIN
  -- auth.uid() liest die Ansprueche des JWT aus `request.jwt.claims`. Genau
  -- die werden hier gesetzt, statt die Funktion zu ersetzen: Auf einer echten
  -- Instanz gehoert das Schema `auth` dem Auth-Dienst, und `postgres` darf
  -- dort nichts anlegen ("permission denied for schema auth"). Sie zu
  -- ueberschreiben waere ausserdem genau das, was der Kopf von
  -- e2e_prisma_nachbildung.sql verbietet.
  --
  -- `true` heisst: nur fuer diese Transaktion. Nach dem Block ist die Angabe
  -- wieder weg.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nutzer)::text, true);

  INSERT INTO public.organizations (id, name) VALUES (org_id, 'Pruefwerk')
    ON CONFLICT (id) DO NOTHING;

  FOR fall IN
    SELECT * FROM (VALUES
      -- Rolle,   Mindestrolle, erwartet
      ('viewer', 'viewer',  true),
      ('viewer', 'editor',  false),
      ('viewer', 'admin',   false),
      ('editor', 'viewer',  true),
      ('editor', 'editor',  true),
      ('editor', 'admin',   false),
      ('admin',  'viewer',  true),
      ('admin',  'editor',  true),
      ('admin',  'admin',   true),
      -- Eine unbekannte Rolle zaehlt als niedrigste: im Zweifel ablehnen.
      ('gast',   'viewer',  false),
      -- "owner" ist in der Oberflaeche die hoechste Rolle und muss alles duerfen.
      ('owner',  'admin',   true)
    ) AS t(rolle, mindest, erwartet)
  LOOP
    DELETE FROM public.organization_members WHERE organization_id = org_id;
    INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (org_id, nutzer, fall.rolle);

    SELECT public.has_org_role(org_id, fall.mindest) INTO ist;

    IF ist IS DISTINCT FROM fall.erwartet THEN
      RAISE EXCEPTION 'Rangfolge falsch: Rolle % gegen Mindestrolle % ergab %, erwartet %',
        fall.rolle, fall.mindest, ist, fall.erwartet;
    END IF;
  END LOOP;

  -- Ohne Mitgliedschaft ist alles verboten.
  DELETE FROM public.organization_members WHERE organization_id = org_id;
  IF public.has_org_role(org_id, 'viewer') THEN
    RAISE EXCEPTION 'Ein Nichtmitglied darf nichts sehen, has_org_role sagte aber ja.';
  END IF;

  -- Aufraeumen, damit der Test wiederholbar ist.
  DELETE FROM public.organizations WHERE id = org_id;

  RAISE NOTICE 'Rangfolge: alle 11 Faelle wie erwartet.';
END
$$;
