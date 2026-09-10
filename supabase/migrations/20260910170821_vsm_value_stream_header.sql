-- Kopfangaben eines Wertstroms: wo aufgenommen wurde, in welchem
-- Schichtmodell, wann und von wem (2026-09-09).
--
-- Hintergrund: Ein angelegter Wertstrom trug bisher nur einen Namen. Wer das
-- Blatt spaeter in die Hand bekommt, sieht Prozesse und Zahlen, aber nicht,
-- welche Linie gemeint ist, gegen welches Schichtmodell die Taktzeit rechnet
-- und ob die Aufnahme von letzter Woche oder aus dem letzten Jahr stammt. Eine
-- Wertstromaufnahme ist ein datierter Befund, keine Dauerwahrheit.
--
-- Zum Schichtmodell: available_minutes_per_day bleibt der eine Wert, den alles
-- liest — calculateKpis, der Szenarienvergleich, der Wizard, das PDF. Die
-- beiden neuen Spalten sagen nur, *wie* er zustande kam, und die Oberflaeche
-- rechnet ihn daraus aus. Von Hand abweichen bleibt erlaubt: Wer eine gemessene
-- Nettozeit hat, die nicht zum Modell passt, traegt sie ein und behaelt sie.
-- Ein Kennzeichen dafuer braucht es nicht — weicht der Wert vom Modell ab, ist
-- das die Abweichung, und lib/vsm/shiftModel.ts meldet sie.
--
-- Alle Spalten nullable: Bestehende Projekte haben kein Schichtmodell und
-- keinen Aufnahmevermerk, und null sagt genau das, statt etwas zu erfinden.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS line_label       text,
  ADD COLUMN IF NOT EXISTS shift_count      integer,
  ADD COLUMN IF NOT EXISTS shift_net_minutes numeric,
  ADD COLUMN IF NOT EXISTS recorded_on      date,
  ADD COLUMN IF NOT EXISTS recorded_by      text;

COMMENT ON COLUMN public.projects.line_label IS
  'Linie, Zelle oder Bereich, in dem aufgenommen wurde. Steht im Kopf der Zeichenflaeche und im PDF, damit ein Blatt ohne Rueckfrage zuzuordnen ist.';

COMMENT ON COLUMN public.projects.shift_count IS
  'Anzahl Schichten pro Tag. Zusammen mit shift_net_minutes die Herkunft von available_minutes_per_day.';

COMMENT ON COLUMN public.projects.shift_net_minutes IS
  'Nettominuten je Schicht, also ohne Pausen. 900 Minuten koennen zwei Schichten zu 450 oder drei zu 300 sein — aus der Tagessumme allein ist das nicht zurueckzurechnen.';

COMMENT ON COLUMN public.projects.recorded_on IS
  'Datum der Aufnahme des Ist-Zustands. Eine Wertstromaufnahme ist ein datierter Befund; ohne Datum ist nicht zu erkennen, ob das Blatt noch gilt.';

COMMENT ON COLUMN public.projects.recorded_by IS
  'Wer aufgenommen hat. Freier Text und bewusst kein Verweis auf auth.users: Im Workshop nimmt oft jemand auf, der keinen Zugang zum Werkzeug hat.';
