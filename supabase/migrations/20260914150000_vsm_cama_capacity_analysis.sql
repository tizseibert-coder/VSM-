-- CAMA: die Kapazitaetsampel, als eigenstaendiges Linien-Modul (2026-09-14,
-- ueberarbeitet 2026-09-17).
--
-- Plan und Begruendung: docs/plan-cama-line-module.md. Ersetzt die urspruengliche
-- Fassung dieser Datei (Kernentscheidung "eine CAMA-Linie ist ein VSM-Prozess",
-- siehe docs/plan-cama-capacity-analysis.md), bevor diese je auf einer Datenbank
-- ausserhalb des Testsystems lief (siehe dort, Abschnitt "Testsystem, nicht
-- Prod") — eine Migration, die noch nirgends Ist-Zustand war, braucht keine
-- Reparaturmigration, sie wird direkt korrigiert. Der Dateiname/Zeitstempel
-- bleibt, die Git-Historie zeigt die Ueberarbeitung.
--
-- Nutzerentscheidung 2026-09-17: Kapazitaet ist eine Eigenschaft der Linie, nicht
-- des VSM-Szenarios. Eine Linie (z. B. "Drehen") existiert unabhaengig davon, ob
-- dafuer je ein VSM gezeichnet wird — deshalb drei eigene Tabellen statt zwei
-- Spalten auf `processes`:
--
--   production_lines  — der reine Stammsatz (Modul 0), organisationsweit,
--                        kennt weder VSM noch CAMA. Kuenftige Module
--                        referenzieren nur line_id, fassen diese Tabelle sonst
--                        nie an — dasselbe Prinzip wie vsm_billing_customers
--                        neben organization_entitlements.
--   line_capacity      — CAMA-Modul: Schichtmodell, Monatsnachfrage (Basis und
--                        Stress/+X %), 1:1 an eine Linie gehaengt.
--   processes.line_id  — VSM-Modul: optionale Verknuepfung einer Prozessbox auf
--                        eine bestehende Linie. ON DELETE SET NULL: ein VSM
--                        bleibt gueltig, auch wenn die verknuepfte Linie entfaellt.
--
-- Eigentuemergrenze wie ueberall in diesem Schema: alle vier Objekte gehoeren
-- Taktane (VSM Builder), nicht Prisma/LeanPulse.

-- ═══════════════════════════════════════════
-- 1) production_lines — der Stammsatz
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.production_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_lines_organization_id ON public.production_lines USING btree (organization_id);

COMMENT ON TABLE public.production_lines IS
  'Firmenweiter Stammsatz einer Linie/eines Arbeitsplatzes (z. B. "Drehen"), unabhaengig von jedem VSM-Projekt. Traegt selbst keine Fachdaten — die haelt je ein eigenes Modul (siehe line_capacity), damit ein kuenftiges drittes Modul diese Tabelle nie aendern muss.';

DROP TRIGGER IF EXISTS set_production_lines_updated_at ON public.production_lines;
CREATE TRIGGER set_production_lines_updated_at
  BEFORE UPDATE ON public.production_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view production lines" ON public.production_lines;
CREATE POLICY "members can view production lines"
  ON public.production_lines FOR SELECT
  USING (has_org_role(organization_id, 'viewer'));

DROP POLICY IF EXISTS "editors can write production lines" ON public.production_lines;
CREATE POLICY "editors can write production lines"
  ON public.production_lines FOR ALL
  USING (has_org_role(organization_id, 'editor'))
  WITH CHECK (has_org_role(organization_id, 'editor'));

-- Hilfsfunktion fuer alle Kindtabellen von production_lines, exaktes Gegenstueck
-- zu project_org_id() aus 20260830160000_vsm_authorization_layer.sql.
CREATE OR REPLACE FUNCTION public.line_org_id(p_line_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select organization_id from public.production_lines where id = p_line_id;
$$;

-- ═══════════════════════════════════════════
-- 2) vsm_org_settings — firmenweiter Jahreskalender
-- ═══════════════════════════════════════════
-- Unveraendert gegenueber der Vorfassung dieser Migration: ein Kalender pro
-- Firma (Nutzerentscheidung 2026-09-14), nicht Teil der Linien-Umstellung vom
-- 17.09. — liegt weiterhin auf vsm_org_settings, nicht auf production_lines,
-- weil alle Linien einer Firma denselben Kalender teilen.
ALTER TABLE public.vsm_org_settings
  ADD COLUMN IF NOT EXISTS capacity_workdays jsonb;

COMMENT ON COLUMN public.vsm_org_settings.capacity_workdays IS
  'CAMA: Arbeitstage/Monat als jsonb-Objekt {"1":21,...,"12":22}, ein Kalender fuer die ganze Firma. Fehlt ein Monat oder die ganze Spalte (Normalzustand jeder bestehenden Firma), greift ein Vorgabekalender im Code statt eines stillen 0. Keine eigene RLS-Policy noetig: erbt "owners can write org settings" / "members can view org settings" aus 20260905170000_vsm_org_branding_and_invite_settings.sql.';

-- ═══════════════════════════════════════════
-- 3) line_capacity — CAMA-Kapazitaetsdaten je Linie
-- ═══════════════════════════════════════════
-- cycle_time_minutes/operator_count/oee tragen hier eine eigene Kopie derselben
-- drei Groessen, die processes fuer die Takt-vs-Kundentakt-Pruefung schon hat
-- (calculations.ts/capacity.ts) — kein Versehen, sondern die direkte Folge der
-- Entkopplung: eine Linie ohne verknuepftes VSM (der ausdrueckliche
-- Anwendungsfall aus docs/plan-cama-line-module.md, "Linie B hat nur
-- Kapazitaetsdaten, kein VSM") hat sonst keine Quelle fuer ihre Taktrate. Die
-- beiden Werte duerfen auseinanderlaufen, wenn eine Linie *und* ein VSM
-- existieren — dieselbe bewusste Trennung wie zwischen CAMA- und
-- Kundentakt-Ampel schon in capacityAnalysis.ts beschrieben ("zwei
-- verschiedene Fragen, keine Uebereinstimmung noetig"). Beim Anlegen einer
-- Linie aus einer Prozessbox heraus (spaeterer Schritt, ProcessEditPanel)
-- werden diese Felder einmalig aus dem Prozess vorbelegt, bleiben danach aber
-- unabhaengig editierbar.
CREATE TABLE IF NOT EXISTS public.line_capacity (
  line_id                uuid PRIMARY KEY REFERENCES public.production_lines(id) ON DELETE CASCADE,
  cycle_time_minutes     numeric,
  operator_count         integer NOT NULL DEFAULT 1,
  oee                    numeric NOT NULL DEFAULT 78,
  shift_model            smallint,
  monthly_demand         jsonb,
  monthly_demand_stretch jsonb,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'line_capacity_shift_model_check'
  ) THEN
    ALTER TABLE public.line_capacity
      ADD CONSTRAINT line_capacity_shift_model_check
        CHECK (shift_model IS NULL OR shift_model IN (1, 2, 3));
  END IF;
END $$;

-- monthly_demand/monthly_demand_stretch bewusst ohne Form-Constraint, wie schon
-- in der Vorfassung begruendet: die bestehenden jsonb-Spalten dieses Schemas
-- sind durchgehend unbeschraenkt, Form wird an der Oberflaeche/in
-- capacityAnalysis.ts geprueft.
COMMENT ON COLUMN public.line_capacity.cycle_time_minutes IS
  'CAMA: Minuten je Stueck dieser Linie — eigene Kopie, nicht von processes.cycle_time abgeleitet (siehe Tabellenkommentar). Null = noch nicht erfasst.';

COMMENT ON COLUMN public.line_capacity.operator_count IS
  'CAMA: parallele, wirklich identische Arbeitsplaetze dieser Linie — dieselbe Bedingung wie processes.operator_count (siehe capacityAnalysis.ts:CamaLineInput).';

COMMENT ON COLUMN public.line_capacity.oee IS
  'CAMA: NEE dieser Linie in Prozent (0-100), skaliert vor der Rechnung wie processes.oee.';

COMMENT ON COLUMN public.line_capacity.shift_model IS
  'CAMA: 1/2/3-Schicht dieser Linie. Bestimmt die Stunden/Tag (8.2/16.4/24, siehe capacityAnalysis.ts:shiftHoursPerDay). Null = noch nicht erfasst.';

COMMENT ON COLUMN public.line_capacity.monthly_demand IS
  'CAMA: monatliche Basisnachfrage dieser Linie als jsonb-Array [Jan..Dez], 12 Zahlen. Null = noch nicht erfasst.';

COMMENT ON COLUMN public.line_capacity.monthly_demand_stretch IS
  'CAMA: monatliche Nachfrage im Stresstest (z. B. +20 %, aus dem Schneider-CAMA-Playbook uebernommenes Konzept "Load Ratio with Demands Forecast +20%") als jsonb-Array [Jan..Dez]. Null = kein Stresstest hinterlegt, kein fester Faktor zur Basisnachfrage — jede Firma waehlt ihren eigenen Aufschlag.';

DROP TRIGGER IF EXISTS set_line_capacity_updated_at ON public.line_capacity;
CREATE TRIGGER set_line_capacity_updated_at
  BEFORE UPDATE ON public.line_capacity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.line_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view line capacity" ON public.line_capacity;
CREATE POLICY "members can view line capacity"
  ON public.line_capacity FOR SELECT
  USING (has_org_role(line_org_id(line_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write line capacity" ON public.line_capacity;
CREATE POLICY "editors can write line capacity"
  ON public.line_capacity FOR ALL
  USING (has_org_role(line_org_id(line_id), 'editor'))
  WITH CHECK (has_org_role(line_org_id(line_id), 'editor'));

-- ═══════════════════════════════════════════
-- 4) processes.line_id — optionale VSM-Verknuepfung
-- ═══════════════════════════════════════════
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processes.line_id IS
  'Optionale Verknuepfung dieser Prozessbox auf eine firmenweite Linie (production_lines) — die Bruecke zum CAMA-Modul. Null = diese Prozessbox hat keine Kapazitaetsdaten (normal, kein Fehlzustand). ON DELETE SET NULL: das VSM bleibt gueltig, auch wenn die Linie geloescht wird.';

CREATE INDEX IF NOT EXISTS idx_processes_line_id ON public.processes USING btree (line_id);

-- ═══════════════════════════════════════════
-- 5) capacity_actions — Massnahmen zu roten/orangen Linien
-- ═══════════════════════════════════════════
-- Jetzt linien- statt projektgebunden, wie line_capacity: eine Massnahme ("ab
-- Monat 7 Zusatzschicht") betrifft die Linie, unabhaengig davon, ob/in welchem
-- VSM-Projekt sie gerade auftaucht. process_id bleibt als optionaler, rein
-- informativer Verweis bestehen (welche Prozessbox war der Anlass), traegt aber
-- keine Berechtigung mehr — das entscheidet allein line_id.
CREATE TABLE IF NOT EXISTS public.capacity_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id      uuid NOT NULL REFERENCES public.production_lines(id) ON DELETE CASCADE,
  process_id   uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  description  text NOT NULL,
  owner        text,
  due_date     date,
  target_month smallint,
  status       text NOT NULL DEFAULT 'open',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capacity_actions_status_check
    CHECK (status = ANY (ARRAY['open'::text, 'done'::text])),
  CONSTRAINT capacity_actions_target_month_check
    CHECK (target_month IS NULL OR target_month BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS idx_capacity_actions_line_id ON public.capacity_actions USING btree (line_id);
CREATE INDEX IF NOT EXISTS idx_capacity_actions_process_id ON public.capacity_actions USING btree (process_id);

COMMENT ON TABLE public.capacity_actions IS
  'CAMA: Massnahmen mit Owner/Termin zu einer Linie, typischerweise bei orange/roter Ampel angelegt. Linien-, nicht projektgebunden — eine Linie kann Massnahmen haben, ohne dass dafuer je ein VSM existiert.';

COMMENT ON COLUMN public.capacity_actions.process_id IS
  'Optionaler, rein informativer Verweis auf die VSM-Prozessbox, die Anlass fuer diese Massnahme war (falls es ueberhaupt eine gab). Traegt keine Berechtigung — die RLS dieser Tabelle haengt ausschliesslich an line_id.';

COMMENT ON COLUMN public.capacity_actions.target_month IS
  'Welcher CAMA-Monat (1-12) diese Massnahme adressiert, z. B. der Peak-Monat, wegen dem sie angelegt wurde. Optional — nicht jede Massnahme ist monatsgebunden. Unabhaengig von due_date, dem Faelligkeitsdatum ihrer Umsetzung.';

ALTER TABLE public.capacity_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view capacity actions" ON public.capacity_actions;
CREATE POLICY "members can view capacity actions"
  ON public.capacity_actions FOR SELECT
  USING (has_org_role(line_org_id(line_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write capacity actions" ON public.capacity_actions;
CREATE POLICY "editors can write capacity actions"
  ON public.capacity_actions FOR ALL
  USING (has_org_role(line_org_id(line_id), 'editor'))
  WITH CHECK (has_org_role(line_org_id(line_id), 'editor'));
