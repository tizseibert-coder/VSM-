-- Supermarkt-Sizing: die Eingaben, aus denen sich die Sollgroesse eines
-- Pull-Puffers ergibt (2026-09-09).
--
-- Hintergrund: Bisher konnte eine Verbindung im Puffer-Panel von Push auf
-- Supermarkt oder FIFO umgestellt werden, ohne dass der Bestand angefasst
-- wurde. Die alte, unbemessene Push-Menge blieb in wip_count stehen und floss
-- unveraendert in Durchlaufzeit und gebundenes Kapital — ein Szenario, das den
-- ganzen Strom auf Pull umstellt, zeigte dieselbe PLT wie der Ist-Zustand.
--
-- Methodisch verschwindet Bestand beim Wechsel auf Pull nicht, er hoert auf
-- unkontrolliert zu sein und wird bemessen. Diese fuenf Spalten halten die
-- Eingaben dieser Bemessung. Die *berechnete* Groesse steht bewusst in keiner
-- Spalte: Sie ist jederzeit aus den Eingaben ableitbar (siehe
-- src/lib/vsm/supermarketSizing.ts), und was der Nutzer davon bestaetigt,
-- landet in wip_count. Damit bleibt wip_count die einzige Quelle fuer PLT,
-- Kapital, Vergleich und PDF.
--
-- Alle Spalten nullable: null heisst "noch nicht bemessen". Szenariofaehig
-- ohne Zusatzarbeit, weil inventory_buffers bereits scenario_id traegt.

ALTER TABLE public.inventory_buffers
  ADD COLUMN IF NOT EXISTS sizing_adu_per_day    numeric,
  ADD COLUMN IF NOT EXISTS sizing_adu_std_dev    numeric,
  ADD COLUMN IF NOT EXISTS sizing_interval_days  numeric,
  ADD COLUMN IF NOT EXISTS sizing_interval_basis varchar(10),
  ADD COLUMN IF NOT EXISTS sizing_plt_days       numeric;

-- Wie inventory_buffers_kanban_type_check: eine geschlossene Liste, damit die
-- Datenbank und nicht nur die Oberflaeche entscheidet, was hier stehen darf.
-- IF NOT EXISTS gibt es fuer ADD CONSTRAINT nicht, deshalb der DO-Block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_buffers_sizing_interval_basis_check'
  ) THEN
    ALTER TABLE public.inventory_buffers
      ADD CONSTRAINT inventory_buffers_sizing_interval_basis_check
        CHECK (sizing_interval_basis IS NULL
               OR (sizing_interval_basis)::text = ANY (ARRAY['epei'::text, 'cti'::text, 'wq'::text]));
  END IF;
END $$;

COMMENT ON COLUMN public.inventory_buffers.sizing_adu_per_day IS
  'Average Daily Usage in Stueck/Tag: der Verbrauch dieses Teils an dieser Stelle. Bewusst eine Eingabe und nicht aus projects.annual_throughput abgeleitet — das ist der Kundenbedarf des ganzen Stroms und etwas anderes.';

COMMENT ON COLUMN public.inventory_buffers.sizing_adu_std_dev IS
  'Standardabweichung des ADU in Stueck/Tag (Stichprobe). Traegt den Safety Stock; ohne sie gibt es keine Bemessung, weil eine gesetzte Annahme eine unnachrechenbare Behauptung waere.';

COMMENT ON COLUMN public.inventory_buffers.sizing_interval_days IS
  'Nachfuellintervall in Tagen fuer den Zyklusbestand. Bei buffer_type = fifo stattdessen die zugelassene Wartezeit der Bahn.';

COMMENT ON COLUMN public.inventory_buffers.sizing_interval_basis IS
  'Welche Groesse in sizing_interval_days steht: epei (Every Part Every Interval), cti (Cycle Time Interval) oder wq (Waiting Queue). Aendert Beschriftung und Vorschlag, nicht die Rechnung.';

COMMENT ON COLUMN public.inventory_buffers.sizing_plt_days IS
  'Prozessdurchlaufzeit in Tagen, mit der bemessen wurde. Festgehalten und nicht bei jeder Anzeige neu gezogen: Die Sollgroesse landet als wip_count in genau der PLT, aus der sie berechnet wurde — ohne festen Wert wanderten die Zahlen bei jedem Oeffnen.';
