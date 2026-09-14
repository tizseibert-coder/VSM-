-- CAMA: die Kapazitaetsampel (2026-09-14).
--
-- Plan und Begruendung: docs/plan-cama-capacity-analysis.md. Diese Migration
-- setzt nur den ersten Schritt der dort festgehaltenen Umsetzungsreihenfolge
-- um (Schema) — reine Logik, Eingabemasken und die Kapazitaetsseite folgen
-- in eigenen Schritten.
--
-- Eine CAMA-Linie ist ein bestehender VSM-Prozess: Taktrate leitet sich aus
-- `cycle_time` ab (Minuten/Stueck, bereits vorhanden), NEE ist `oee` (bereits
-- 0-100 %). Neu sind nur, was CAMA zusaetzlich zur bestehenden VSM-Erfassung
-- braucht: das Schichtmodell und die Monatsnachfrage je Linie, ein
-- firmenweiter Jahreskalender, und ein Aktionsplan zu roten/orangen Linien.
--
-- Wie schon bei piece_value/currency, has_heijunka etc.: ausschliesslich
-- additive, nullable Spalten. Bestehender Code, der sie nicht kennt, ist
-- unberuehrt — das gilt hier besonders, weil Test und Prod dasselbe
-- Supabase-Projekt teilen (supabase/README.md) und diese Migration in genau
-- der Datenbank landet, die auch Prod bedient.

-- ═══════════════════════════════════════════
-- 1) processes — Schichtmodell und Monatsnachfrage je Linie/Szenario
-- ═══════════════════════════════════════════
-- Beide Spalten sind scenario-scoped, weil processes es schon ist: eine neue
-- Forecast-Revision (RF1/RF2/RF3) ist technisch ein Szenario mit eigener
-- Kopie dieser Zeile, siehe Plan Abschnitt "RF1/RF2/RF3-Forecastvergleich".
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS shift_model smallint,
  ADD COLUMN IF NOT EXISTS monthly_demand jsonb;

-- Geschlossene Liste wie inventory_buffers_kanban_type_check: 1/2/3-Schicht,
-- sonst nichts. IF NOT EXISTS gibt es fuer ADD CONSTRAINT nicht, deshalb der
-- DO-Block (gleiches Muster wie inventory_buffers_sizing_interval_basis_check
-- in 20260909111713_vsm_supermarket_sizing.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processes_shift_model_check'
  ) THEN
    ALTER TABLE public.processes
      ADD CONSTRAINT processes_shift_model_check
        CHECK (shift_model IS NULL OR shift_model IN (1, 2, 3));
  END IF;
END $$;

-- monthly_demand bleibt bewusst ohne Form-Constraint (kein "Array mit genau
-- 12 Zahlen"-CHECK): Die bestehenden jsonb-Spalten dieses Schemas
-- (spaghetti_layouts.stations/paths, activity_logs.details, vsm_leads.payload)
-- sind durchgehend unbeschraenkt, die Form wird an der Oberflaeche/in
-- capacityAnalysis.ts geprueft. Eine eigene Ausnahme hier waere Inkonsequenz,
-- kein Zugewinn an Sicherheit.
COMMENT ON COLUMN public.processes.shift_model IS
  'CAMA: 1/2/3-Schicht dieser Linie. Bestimmt die Stunden/Tag (8.2/16.4/24, siehe capacityAnalysis.ts:shiftHoursPerDay). Null = noch nicht erfasst.';

COMMENT ON COLUMN public.processes.monthly_demand IS
  'CAMA: monatliche Nachfrage dieser Linie als jsonb-Array [Jan..Dez], 12 Zahlen. Null = noch nicht erfasst. Scenario-scoped wie die Zeile selbst — eine Forecast-Revision (RF1/RF2/RF3) ist ein Szenario mit eigener Kopie, siehe docs/plan-cama-capacity-analysis.md.';

-- ═══════════════════════════════════════════
-- 2) vsm_org_settings — firmenweiter Jahreskalender
-- ═══════════════════════════════════════════
-- Nutzerentscheidung 2026-09-14: ein Kalender pro Firma, nicht pro Projekt.
-- Liegt deshalb auf vsm_org_settings (Taktane-eigene Org-Settings-Tabelle),
-- nicht auf projects und nicht auf organizations — letztere gehoert
-- Prisma/LeanPulse (supabase/README.md), genau wie default_currency und
-- default_available_minutes schon heute firmenweite Vorgaben hier tragen,
-- nicht auf projects.
ALTER TABLE public.vsm_org_settings
  ADD COLUMN IF NOT EXISTS capacity_workdays jsonb;

COMMENT ON COLUMN public.vsm_org_settings.capacity_workdays IS
  'CAMA: Arbeitstage/Monat als jsonb-Objekt {"1":21,...,"12":22}, ein Kalender fuer die ganze Firma. Fehlt ein Monat oder die ganze Spalte (Normalzustand jeder bestehenden Firma), greift ein Vorgabekalender im Code statt eines stillen 0. Keine eigene RLS-Policy noetig: erbt "owners can write org settings" / "members can view org settings" aus 20260905170000_vsm_org_branding_and_invite_settings.sql.';

-- ═══════════════════════════════════════════
-- 3) capacity_actions — Massnahmen zu roten/orangen Linien
-- ═══════════════════════════════════════════
-- Owner/Termin je Linie, wie in der CAMA-Vorlage als "wertvoll" markiert.
-- Traegt project_id direkt (nicht nur process_id): dasselbe Muster wie jede
-- andere Kindtabelle in diesem Schema (processes, inventory_buffers, ...) —
-- project_org_id(project_id) wertet in einem Schritt aus, ohne durch
-- processes hindurchzumuessen (siehe project_org_id-Kommentar in
-- 20260830160000_vsm_authorization_layer.sql).
CREATE TABLE IF NOT EXISTS public.capacity_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  process_id  uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  description text NOT NULL,
  owner       text,
  due_date    date,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capacity_actions_status_check
    CHECK (status = ANY (ARRAY['open'::text, 'done'::text]))
);

CREATE INDEX IF NOT EXISTS idx_capacity_actions_project_id ON public.capacity_actions USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_capacity_actions_process_id ON public.capacity_actions USING btree (process_id);

COMMENT ON TABLE public.capacity_actions IS
  'CAMA: Massnahmen mit Owner/Termin zu einer Linie (Prozess), typischerweise bei orange/roter Ampel angelegt. Kein Bezug zu einem einzelnen Monat — eine Linie hat eine Massnahmenliste, kein Aktionsplan je Monat.';

ALTER TABLE public.capacity_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view capacity actions" ON public.capacity_actions;
CREATE POLICY "members can view capacity actions"
  ON public.capacity_actions FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write capacity actions" ON public.capacity_actions;
CREATE POLICY "editors can write capacity actions"
  ON public.capacity_actions FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));
