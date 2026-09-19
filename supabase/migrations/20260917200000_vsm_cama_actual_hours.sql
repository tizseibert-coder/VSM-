-- CAMA: Ist-Stunden je Linie und Monat, als Gegenstueck zur Nachfrage-Prognose
-- (2026-09-17, Nutzergespraech "Forecast vs. tatsaechlich geleistete Leistung").
--
-- Nutzerentscheidung: in Stunden erfassen, nicht in Stueck. Eine Linie/ein
-- Arbeitsplatz kann mehrere Produktvarianten mit je eigener Taktrate
-- bedienen (ein VSM deckt oft nur eine Variante ab) — "wie viele Stueck
-- wurden produziert" waere deshalb je nach Mix nicht vergleichbar, "wie
-- viele Stunden wurde diese Linie tatsaechlich bearbeitet" dagegen schon:
-- Stunden sind unabhaengig vom Produktmix dieselbe Groesse. Die
-- Forecast-Seite bleibt in capacityAnalysis.ts trotzdem auf der einzigen
-- Taktrate der Linie angewiesen (line_capacity.cycle_time_minutes,
-- dieselbe bestehende Vereinfachung wie bei monthly_demand) — die
-- Ist-Stunden korrigieren das nicht, sie stehen daneben, nicht anstelle.
ALTER TABLE public.line_capacity
  ADD COLUMN IF NOT EXISTS monthly_actual_hours jsonb;

COMMENT ON COLUMN public.line_capacity.monthly_actual_hours IS
  'CAMA: tatsaechlich geleistete Arbeitsstunden dieser Linie je Monat als jsonb-Array [Jan..Dez], 12 Zahlen. In Stunden statt Stueck, weil eine Linie mehrere Produktvarianten mit unterschiedlicher Taktrate bedienen kann (siehe Migrationskommentar) und Stunden dafuer die vergleichbare Groesse sind. Null = noch nicht erfasst; ein einzelner Monat ohne Wert bleibt in resolveMonthlyValues() vom Fallback (nicht 0) unterschieden wie monthly_demand.';

-- Keine eigene RLS-Policy noetig: dieselbe Spalte, dieselbe Zeile wie
-- monthly_demand, erbt "editors can write line capacity" aus
-- 20260914150000_vsm_cama_capacity_analysis.sql.
