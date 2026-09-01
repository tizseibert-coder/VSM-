-- Phase 8 / Future-State-Wizard: Felder fuer die drei Fragen (6-8), die ohne
-- eigene Datenrepraesentation waren, plus Szenario-Abstammung (2026-09-01).
--
-- Wie die Autorisierungsschicht (20260830160000) eine nachtraeglich
-- eingecheckte Baseline: alle vier Spalten liefen schon seit dem 12.08.
-- produktiv (Supabase-Migration `phase8_future_state_wizard_fields` in der
-- Projekthistorie), standen bis heute aber nur in der Datenbank, nicht im
-- Repository — genau die Konstellation, die
-- docs/plan-future-state-wizard.md als offene Reproduzierbarkeitsluecke
-- benennt. Diese Datei schreibt den Ist-Zustand fest, faellt also mit
-- `IF NOT EXISTS` durch, statt auf der Produktivdatenbank neu anzulegen, was
-- dort schon existiert.
--
-- Eigentuemergrenze wie in 20260830160000: alle vier Spalten haengen an
-- `processes`, `projects` und `scenarios` — Tabellen des VSM Builders.

-- Q6 (Heijunka): haengt am Schrittmacher-Prozess, szenario-gebunden wie
-- is_pacemaker bereits ist (processes.scenario_id) — Ist- und Soll-Zustand
-- koennen sich darin unterscheiden, ohne zusaetzliche Logik.
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS has_heijunka boolean NOT NULL DEFAULT false;

-- Q8 (Kaizen-Blitz): kurze Verbesserungsnotiz, ueber der Prozessbox
-- gezeichnet. Erste Stufe bewusst nur an Prozessen; Bursts an Verbindungen
-- (inventory_buffers) waeren der spaetere Ausbau.
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS kaizen_note text;

-- Q7 (Pitch): Steuerungs-Zeitraster. Auf projects (nicht scenarios), analog
-- zur bestehenden Konvention bei annual_throughput/available_minutes_per_day.
-- Bekannte Einschraenkung: nicht pro Szenario unterschiedlich. Ein
-- scenarios.pitch_minutes mit Rueckfall auf den Projektwert waere der saubere
-- Nachzug, falls das je gebraucht wird.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pitch_minutes numeric;

-- Szenario-Abstammung fuer "neue Iteration aus diesem Szenario" — zeigt auf
-- der Vergleichsseite, dass B aus A hervorging statt unabhaengig vom
-- Ist-Zustand zu entstehen. Selbstreferenzierend, nullable (ein aus dem
-- Ist-Zustand angelegtes Szenario hat keinen Elter), ON DELETE SET NULL
-- kaskadiert das Loeschen des Elters nicht auf seine Abkoemmlinge.
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS parent_scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL;
