-- Referenzdaten fuer den Branchenvergleich.
--
-- ACHTUNG: seed.sql laeuft bei `supabase db reset` gegen eine *frische*
-- Datenbank. Nicht gegen die Produktion ausfuehren — der DELETE unten wuerde
-- dort die gepflegten Werte durch diese Beispieldaten ersetzen.
--
-- Warum es diese Datei gibt: die Werte existierten bisher ausschliesslich in
-- der Produktivdatenbank. Am 30.08. mussten sie dort korrigiert werden (die
-- Zykluszeit-Percentile lagen absteigend vor, p25 > median > p75), und ohne
-- diese Datei waere die Korrektur beim naechsten Aufsetzen einer Umgebung
-- wieder verloren gewesen — dieselbe Drift, die den Signup-Ausfall verursacht
-- hat, nur mit Daten statt mit Schema.
--
-- Konvention: *echte* Percentile, immer aufsteigend p25 <= median <= p75.
-- Welches Ende gut ist, entscheidet der Klassifikator ueber `higherIsBetter`
-- (src/lib/vsm/benchmark.ts), nicht die Ablage. Werte vertauscht abzulegen hat
-- die Anzeige unmoeglich gemacht ("P25 3.4 · Median 2.2 · P75 1.5") und haette
-- beim ersten Import echter Branchenwerte jede Bewertung ins Gegenteil gekippt.
--
-- Die Zahlen sind erfunden. Die UI weist das als "Beispieldaten — keine echten
-- Branchenwerte" aus; sobald reale Erhebungen vorliegen, kommen sie mit
-- source = 'customer_aggregated' dazu und bleiben von diesem Seed unberuehrt.

delete from public.benchmark_reference where source = 'synthetic';

insert into public.benchmark_reference (industry, company_size, metric_name, p25, median, p75, source) values
  -- Zykluszeit in Minuten: kleiner ist besser, p25 ist also das gute Ende.
  ('Dreherei',            '50-500 MA', 'cycle_time_min', 1.5, 2.2, 3.4, 'synthetic'),
  ('Montage',             '50-500 MA', 'cycle_time_min', 2.0, 3.0, 4.5, 'synthetic'),
  ('Elektronikfertigung', '50-500 MA', 'cycle_time_min', 1.1, 1.8, 2.8, 'synthetic'),
  -- OEE in Prozent: groesser ist besser, p75 ist das gute Ende.
  ('Dreherei',            '50-500 MA', 'oee_percent',    74,  79,  84,  'synthetic'),
  ('Montage',             '50-500 MA', 'oee_percent',    70,  77,  85,  'synthetic'),
  ('Elektronikfertigung', '50-500 MA', 'oee_percent',    76,  82,  88,  'synthetic');
