-- Prueft die Autorisierungsschicht auf ihr Verhalten, nicht auf ihre Form.
--
-- Voraussetzung: `fremde_voraussetzungen.sql`, alle Migrationen und
-- `fremde_rechtelogik.sql` sind gelaufen. Aufgerufen wird die Datei von
-- `rechte-pruefen.sh`; einzeln von Hand ergibt sie keinen Sinn.
--
-- Jede bestandene Pruefung meldet sich mit `ok`. Die erste, die fehlschlaegt,
-- bricht den Lauf ab — bei ON_ERROR_STOP also den ganzen Test.

\set ON_ERROR_STOP on

-- ═══════════════════════════════════════════
-- Hilfsmittel
-- ═══════════════════════════════════════════
-- Prozeduren, nicht Funktionen: `CALL` schreibt nichts auf die Ausgabe, ein
-- `SELECT pruef.…()` haengte hinter jede Pruefung eine leere Ergebnistabelle.
-- Bei drei Dutzend Pruefungen ist das der Unterschied zwischen einem lesbaren
-- Protokoll und einem, das niemand liest.
--
-- Alle nehmen den Befehl als Text und fuehren ihn mit EXECUTE aus. Das ist
-- hier kein Umweg, sondern der Punkt: Nur so laesst sich ein Befehl abfangen,
-- der fehlschlagen *soll*.
CREATE SCHEMA IF NOT EXISTS pruef;

-- Zaehlt und vergleicht.
CREATE OR REPLACE PROCEDURE pruef.zaehlt(abfrage text, soll bigint, was text)
LANGUAGE plpgsql AS $$
DECLARE ist bigint;
BEGIN
  EXECUTE abfrage INTO ist;
  IF ist IS DISTINCT FROM soll THEN
    RAISE EXCEPTION 'FEHLGESCHLAGEN — %: erwartet %, bekommen %', was, soll, ist;
  END IF;
  RAISE NOTICE '  ok  %', was;
END $$;

-- Zaehlt und verlangt mindestens so viele. Fuer die Faelle, in denen die
-- genaue Zahl aus dem Seed kommt und nicht Gegenstand der Pruefung ist.
CREATE OR REPLACE PROCEDURE pruef.mindestens(abfrage text, soll bigint, was text)
LANGUAGE plpgsql AS $$
DECLARE ist bigint;
BEGIN
  EXECUTE abfrage INTO ist;
  IF ist < soll THEN
    RAISE EXCEPTION 'FEHLGESCHLAGEN — %: erwartet mindestens %, bekommen %', was, soll, ist;
  END IF;
  RAISE NOTICE '  ok  % (% Zeilen)', was, ist;
END $$;

-- Erwartet, dass RLS den Befehl *abweist*. Ein abgewiesenes INSERT wirft
-- 42501; ein abgewiesenes UPDATE oder DELETE wirft nichts, sondern trifft
-- null Zeilen — dafuer ist `pruef.trifft_nichts` da.
CREATE OR REPLACE PROCEDURE pruef.abgewiesen(befehl text, was text)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE befehl;
  RAISE EXCEPTION
    'FEHLGESCHLAGEN — %: der Befehl lief durch, obwohl ihn RLS haette abweisen muessen', was;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '  ok  %', was;
END $$;

-- Erwartet, dass der Befehl laeuft, aber keine Zeile trifft: Die
-- USING-Klausel blendet sie aus, bevor sie geaendert werden kann. Das ist der
-- stillste aller Faelle und deshalb der, den man am ehesten uebersieht — kein
-- Fehler, keine Meldung, nur nichts passiert.
CREATE OR REPLACE PROCEDURE pruef.trifft_nichts(befehl text, was text)
LANGUAGE plpgsql AS $$
DECLARE getroffen bigint;
BEGIN
  EXECUTE befehl;
  GET DIAGNOSTICS getroffen = ROW_COUNT;
  IF getroffen <> 0 THEN
    RAISE EXCEPTION 'FEHLGESCHLAGEN — %: % Zeile(n) getroffen, erwartet waren 0', was, getroffen;
  END IF;
  RAISE NOTICE '  ok  %', was;
END $$;

-- Erwartet, dass der Befehl genau so viele Zeilen trifft wie angegeben.
CREATE OR REPLACE PROCEDURE pruef.trifft(befehl text, soll bigint, was text)
LANGUAGE plpgsql AS $$
DECLARE getroffen bigint;
BEGIN
  EXECUTE befehl;
  GET DIAGNOSTICS getroffen = ROW_COUNT;
  IF getroffen <> soll THEN
    RAISE EXCEPTION 'FEHLGESCHLAGEN — %: % Zeile(n) getroffen, erwartet waren %', was, getroffen, soll;
  END IF;
  RAISE NOTICE '  ok  %', was;
END $$;

-- Setzt den Nutzer, den `auth.uid()` zurueckgibt — das Gegenstueck dazu, dass
-- sich jemand anderes anmeldet und PostgREST ein anderes JWT weiterreicht.
CREATE OR REPLACE PROCEDURE pruef.als(nutzer uuid)
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', nutzer::text, false);
END $$;

-- Die Pruefungen laufen als `authenticated` bzw. `anon`. Ohne dieses Recht
-- kaeme keine von ihnen bis zu dem, was sie pruefen soll.
GRANT USAGE ON SCHEMA pruef TO public;

-- ═══════════════════════════════════════════
-- Testdaten
-- ═══════════════════════════════════════════
-- Zwei Firmen, damit sich Mandantentrennung ueberhaupt pruefen laesst: Ein
-- Test mit einer einzigen Organisation kann nicht zwischen "die Policy wirkt"
-- und "es gibt nichts zu sehen" unterscheiden.
--
-- Die Ids sind von Hand gesetzt und sprechend (a… = Firma A, b… = Firma B),
-- damit eine Fehlermeldung lesbar bleibt.
\echo 'Testdaten anlegen …'

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),  -- Betrachterin, Firma A
  ('aaaaaaaa-0000-0000-0000-000000000002'),  -- Bearbeiter,   Firma A
  ('aaaaaaaa-0000-0000-0000-000000000003'),  -- Inhaberin,    Firma A
  ('bbbbbbbb-0000-0000-0000-000000000001'),  -- Bearbeiter,   Firma B
  ('cccccccc-0000-0000-0000-000000000001');  -- angemeldet, aber in keiner Firma

INSERT INTO public.organizations (id, name) VALUES
  ('0a000000-0000-0000-0000-00000000000a', 'Firma A'),
  ('0b000000-0000-0000-0000-00000000000b', 'Firma B');

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('0a000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'viewer'),
  ('0a000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'editor'),
  ('0a000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'owner'),
  ('0b000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'editor');

INSERT INTO public.projects (id, organization_id, name) VALUES
  ('00000000-0000-0000-0000-0000000000aa', '0a000000-0000-0000-0000-00000000000a', 'Wertstrom A'),
  ('00000000-0000-0000-0000-0000000000bb', '0b000000-0000-0000-0000-00000000000b', 'Wertstrom B');

INSERT INTO public.processes (id, project_id, name, cycle_time) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000aa', 'Saegen',  42),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000bb', 'Fraesen', 42);

-- ═══════════════════════════════════════════
-- 1) RLS ist ueberhaupt eingeschaltet
-- ═══════════════════════════════════════════
-- Steht vor allem anderen: Ohne dieses Flag laufen saemtliche Pruefungen
-- unten ins Leere, weil dann jede Zeile fuer jeden sichtbar ist. Eine
-- vergessene Zeile `ALTER TABLE … ENABLE ROW LEVEL SECURITY` sieht in einer
-- Migration aus wie nichts.
\echo ''
\echo '1) Row Level Security eingeschaltet'
DO $$
DECLARE t text; an boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','processes','inventory_buffers','scenarios','spaghetti_layouts',
    'reports','historical_metrics','benchmark_data','activity_logs','benchmark_reference']
  LOOP
    SELECT relrowsecurity INTO an FROM pg_class WHERE oid = ('public.'||t)::regclass;
    IF NOT an THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — RLS ist auf public.% nicht eingeschaltet', t;
    END IF;
  END LOOP;
  RAISE NOTICE '  ok  alle zehn Tabellen haben RLS';
END $$;

-- ═══════════════════════════════════════════
-- 2) Die Betrachterin darf lesen und nichts sonst
-- ═══════════════════════════════════════════
\echo ''
\echo '2) Rolle viewer'
SET ROLE authenticated;
CALL pruef.als('aaaaaaaa-0000-0000-0000-000000000001');

CALL pruef.zaehlt('select count(*) from public.projects', 1,
  'viewer sieht genau den Wertstrom der eigenen Firma');
CALL pruef.zaehlt('select count(*) from public.processes', 1,
  'viewer sieht genau den Prozess der eigenen Firma');

CALL pruef.abgewiesen(
  $$INSERT INTO public.processes (project_id, name, cycle_time)
    VALUES ('00000000-0000-0000-0000-0000000000aa', 'Geschmuggelt', 1)$$,
  'viewer darf keinen Prozess anlegen');

CALL pruef.abgewiesen(
  $$INSERT INTO public.projects (organization_id, name)
    VALUES ('0a000000-0000-0000-0000-00000000000a', 'Heimlich')$$,
  'viewer darf keinen Wertstrom anlegen');

CALL pruef.trifft_nichts(
  $$UPDATE public.projects SET name = 'Umbenannt'
    WHERE id = '00000000-0000-0000-0000-0000000000aa'$$,
  'viewer darf den Wertstrom nicht umbenennen');

CALL pruef.trifft_nichts(
  $$DELETE FROM public.processes WHERE id = '00000000-0000-0000-0000-0000000000a1'$$,
  'viewer darf keinen Prozess loeschen');

-- ═══════════════════════════════════════════
-- 3) Der Bearbeiter darf schreiben — aber nur bei sich
-- ═══════════════════════════════════════════
\echo ''
\echo '3) Rolle editor'
CALL pruef.als('aaaaaaaa-0000-0000-0000-000000000002');

CALL pruef.zaehlt('select count(*) from public.projects', 1,
  'editor sieht nur die eigene Firma');

CALL pruef.trifft(
  $$INSERT INTO public.processes (project_id, name, cycle_time)
    VALUES ('00000000-0000-0000-0000-0000000000aa', 'Entgraten', 7)$$,
  1, 'editor darf einen Prozess anlegen');

CALL pruef.trifft(
  $$UPDATE public.projects SET description = 'Aufgenommen 2026'
    WHERE id = '00000000-0000-0000-0000-0000000000aa'$$,
  1, 'editor darf den Wertstrom aendern');

CALL pruef.trifft(
  $$DELETE FROM public.processes WHERE name = 'Entgraten'$$,
  1, 'editor darf einen Prozess loeschen');

-- Die Mandantengrenze: derselbe Befehl, fremdes Projekt.
CALL pruef.abgewiesen(
  $$INSERT INTO public.processes (project_id, name, cycle_time)
    VALUES ('00000000-0000-0000-0000-0000000000bb', 'Uebergriff', 1)$$,
  'editor darf nicht in den Wertstrom der anderen Firma schreiben');

CALL pruef.trifft_nichts(
  $$UPDATE public.processes SET name = 'Uebergriff'
    WHERE id = '00000000-0000-0000-0000-0000000000b1'$$,
  'editor darf den fremden Prozess nicht aendern');

-- Die Inhaberin steht ueber dem Bearbeiter und muss folglich alles duerfen,
-- was er darf. Das ist kein Selbstlaeufer: 'owner' kommt in der
-- Autorisierungsschicht nirgends vor, die Rangfolge kennt nur die fremde
-- has_org_role(). Waere 'owner' dort nicht eingetragen, saehe die Inhaberin
-- ihre eigene Firma nicht — und gemerkt haette man es an dem Tag, an dem die
-- erste Kundin sich anmeldet.
CALL pruef.als('aaaaaaaa-0000-0000-0000-000000000003');

CALL pruef.zaehlt('select count(*) from public.projects', 1,
  'owner sieht den eigenen Wertstrom');

CALL pruef.trifft(
  $$INSERT INTO public.processes (project_id, name, cycle_time)
    VALUES ('00000000-0000-0000-0000-0000000000aa', 'Pruefen', 3)$$,
  1, 'owner darf anlegen, was der editor darf');

CALL pruef.trifft(
  $$DELETE FROM public.processes WHERE name = 'Pruefen'$$,
  1, 'owner darf loeschen, was der editor darf');

CALL pruef.als('aaaaaaaa-0000-0000-0000-000000000002');

-- Die Umgehung ueber den Elternschluessel: ein eigener Prozess wird in ein
-- fremdes Projekt umgehaengt. USING trifft die alte Zeile (erlaubt),
-- WITH CHECK die neue (verboten) — faellt die WITH-CHECK-Klausel weg, waere
-- das ein offenes Scheunentor, und ein reiner Lesetest saehe es nicht.
CALL pruef.abgewiesen(
  $$UPDATE public.processes SET project_id = '00000000-0000-0000-0000-0000000000bb'
    WHERE id = '00000000-0000-0000-0000-0000000000a1'$$,
  'editor darf den eigenen Prozess nicht in die fremde Firma umhaengen');

-- ═══════════════════════════════════════════
-- 4) Wer in keiner Firma ist, sieht nichts
-- ═══════════════════════════════════════════
\echo ''
\echo '4) Angemeldet, aber ohne Mitgliedschaft'
CALL pruef.als('cccccccc-0000-0000-0000-000000000001');

CALL pruef.zaehlt('select count(*) from public.projects', 0,
  'ohne Mitgliedschaft kein Wertstrom');
CALL pruef.zaehlt('select count(*) from public.processes', 0,
  'ohne Mitgliedschaft kein Prozess');

CALL pruef.abgewiesen(
  $$INSERT INTO public.projects (organization_id, name)
    VALUES ('0a000000-0000-0000-0000-00000000000a', 'Fremdanlage')$$,
  'ohne Mitgliedschaft kein Anlegen');

-- ═══════════════════════════════════════════
-- 5) Das Aktivitaetsprotokoll
-- ═══════════════════════════════════════════
-- Vier Zusagen der Migration, eine nach der anderen: anfuegen ja, im fremden
-- Namen nein, in der fremden Firma nein, nachtraeglich aendern oder loeschen
-- nie. Die letzte ist die wichtigste und zugleich die, die man nicht sieht —
-- sie folgt nicht aus einer Policy, sondern aus dem *Fehlen* zweier Policies.
\echo ''
\echo '5) Aktivitaetsprotokoll'
CALL pruef.als('aaaaaaaa-0000-0000-0000-000000000001');

CALL pruef.trifft(
  $$INSERT INTO public.activity_logs (organization_id, user_id, action)
    VALUES ('0a000000-0000-0000-0000-00000000000a',
            'aaaaaaaa-0000-0000-0000-000000000001', 'projekt.geoeffnet')$$,
  1, 'viewer darf die eigene Handlung protokollieren');

CALL pruef.abgewiesen(
  $$INSERT INTO public.activity_logs (organization_id, user_id, action)
    VALUES ('0a000000-0000-0000-0000-00000000000a',
            'aaaaaaaa-0000-0000-0000-000000000002', 'projekt.geloescht')$$,
  'niemand protokolliert im Namen eines anderen');

CALL pruef.abgewiesen(
  $$INSERT INTO public.activity_logs (organization_id, user_id, action)
    VALUES ('0b000000-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-000000000001', 'projekt.geoeffnet')$$,
  'niemand protokolliert in einer fremden Firma');

CALL pruef.trifft_nichts(
  $$UPDATE public.activity_logs SET action = 'harmlos'$$,
  'ein Protokolleintrag laesst sich nicht aendern');

CALL pruef.trifft_nichts(
  $$DELETE FROM public.activity_logs$$,
  'ein Protokolleintrag laesst sich nicht loeschen');

CALL pruef.als('bbbbbbbb-0000-0000-0000-000000000001');
CALL pruef.zaehlt('select count(*) from public.activity_logs', 0,
  'die fremde Firma sieht das Protokoll nicht');

-- ═══════════════════════════════════════════
-- 6) Die Branchenreferenz
-- ═══════════════════════════════════════════
-- Nicht mandantengebunden, aber auch nicht offen: lesen darf jeder
-- *angemeldete* Nutzer, schreiben niemand. Das `TO authenticated` der Policy
-- ist die ganze Absicherung gegen `anon` — ein Wort, das beim Aufraeumen
-- schnell wegfaellt, weil die Anwendung auch ohne es laeuft.
\echo ''
\echo '6) Branchenreferenz'
CALL pruef.als('cccccccc-0000-0000-0000-000000000001');

-- Mindestens eine: Wie viele Referenzwerte der Seed traegt, ist seine Sache
-- und aendert sich. Dass ein angemeldeter Nutzer sie sieht, ist die Zusage.
CALL pruef.mindestens('select count(*) from public.benchmark_reference', 1,
  'angemeldete Nutzer lesen die Referenzwerte');

CALL pruef.abgewiesen(
  $$INSERT INTO public.benchmark_reference (industry, company_size, metric_name)
    VALUES ('Erfunden', 'gross', 'durchlaufzeit')$$,
  'angemeldete Nutzer schreiben keine Referenzwerte');

RESET ROLE;
SET ROLE anon;
CALL pruef.zaehlt('select count(*) from public.benchmark_reference', 0,
  'nicht angemeldet: keine Referenzwerte');
CALL pruef.zaehlt('select count(*) from public.projects', 0,
  'nicht angemeldet: keine Wertstroeme');
RESET ROLE;

-- ═══════════════════════════════════════════
-- 7) Die sieben Kindtabellen tragen dasselbe Muster
-- ═══════════════════════════════════════════
-- Oben laeuft `processes` stellvertretend durch alle Faelle. Die sechs
-- Geschwister hier einzeln durchzuspielen hiesse, sechsmal dasselbe zu
-- schreiben — und die Pflichtspalten jeder Tabelle mitzupflegen.
--
-- Stattdessen der Katalog: Jede Kindtabelle muss genau zwei Policies haben,
-- die lesende ab 'viewer', die schreibende ab 'editor', beide ueber
-- `project_org_id(project_id)` und die schreibende mit WITH CHECK. Das faengt
-- genau den Fehler, der bei acht von Hand ausgeschriebenen Bloecken droht:
-- ein kopierter Block, in dem ein Wort nicht mitgeaendert wurde.
--
-- Geprueft wird auf Vorkommen, nicht auf Wortlaut: Wie Postgres den Ausdruck
-- einer Policy ablegt, unterscheidet sich zwischen den Versionen — dieselbe
-- Falle, die in supabase/README.md schon bei den vier CHECK-Constraints steht.
\echo ''
\echo '7) Muster der Kindtabellen'
DO $$
DECLARE
  t text;
  lese_qual text;
  schreib_qual text;
  schreib_check text;
  anzahl int;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'processes','inventory_buffers','scenarios','spaghetti_layouts',
    'reports','historical_metrics','benchmark_data']
  LOOP
    SELECT count(*) INTO anzahl
      FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF anzahl <> 2 THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.% hat % Policies, erwartet waren 2', t, anzahl;
    END IF;

    SELECT qual INTO lese_qual
      FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT';
    SELECT qual, with_check INTO schreib_qual, schreib_check
      FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd = 'ALL';

    IF lese_qual IS NULL THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.% hat keine SELECT-Policy', t;
    END IF;
    -- Fehlt WITH CHECK, nimmt Postgres dafuer die USING-Klausel — die Wirkung
    -- waere hier also dieselbe. Geprueft wird trotzdem, und zwar auf die
    -- ausgeschriebene Form: Die Migration schreibt beide Klauseln hin, damit
    -- man beim Lesen sieht, was beim Schreiben geprueft wird. Wer die eine
    -- weglaesst, aendert heute nichts und macht den naechsten Leser raten.
    IF schreib_qual IS NULL THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.%: die schreibende Policy fehlt', t;
    END IF;
    IF schreib_check IS NULL THEN
      RAISE EXCEPTION
        'FEHLGESCHLAGEN — public.%: die schreibende Policy schreibt WITH CHECK nicht aus', t;
    END IF;

    IF lese_qual NOT LIKE '%viewer%' THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.%: die lesende Policy nennt nicht ''viewer'' (%)', t, lese_qual;
    END IF;
    IF schreib_qual NOT LIKE '%editor%' OR schreib_check NOT LIKE '%editor%' THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.%: die schreibende Policy nennt nicht ''editor'' (USING %, CHECK %)',
        t, schreib_qual, schreib_check;
    END IF;
    IF lese_qual NOT LIKE '%project_org_id%' OR schreib_qual NOT LIKE '%project_org_id%' THEN
      RAISE EXCEPTION 'FEHLGESCHLAGEN — public.%: eine Policy haengt nicht an project_org_id(project_id)', t;
    END IF;

    RAISE NOTICE '  ok  public.% — lesen ab viewer, schreiben ab editor', t;
  END LOOP;
END $$;

\echo ''
\echo 'Alle Rechte-Pruefungen durchgelaufen.'
