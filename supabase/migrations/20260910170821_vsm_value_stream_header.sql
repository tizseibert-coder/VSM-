-- Kopfzeilen einer Wertstromaufnahme: Linie, Schichtmodell und wann/von wem
-- aufgenommen wurde (2026-09-10).
--
-- Wie 20260901174003 eine nachtraeglich eingecheckte Baseline: Diese fuenf
-- Spalten liefen bereits seit dem 10.09. produktiv (Supabase-Migration
-- `vsm_value_stream_header` in der Projekthistorie), standen bis heute aber
-- nur in der Datenbank, nicht im Repository — ein Verstoss gegen die eigene
-- Regel 4 aus supabase/README.md (jede Aenderung ueber den SQL-Editor
-- braucht eine idempotente, eingecheckte Migration). Diese Datei schreibt
-- den Ist-Zustand fest und faellt dank IF NOT EXISTS auf Prod durch, statt
-- dort etwas anzulegen, das schon existiert.
--
-- Eigentuemergrenze: alle fuenf Spalten haengen an projects, einer Tabelle
-- des VSM Builders.
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
