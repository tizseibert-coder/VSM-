-- Tagesplanung (Modul „pp"): Tagesplan, Ist-Erfassung, Reflexion,
-- Massnahmen und Kein-Programm-Faelle einer Spritzguss-Produktion.
--
-- Plan und Begruendung: docs/plan-tagesplanung-modul.md. Rechenlogik in
-- src/lib/pp/ — diese Tabellen halten nur Eingaben und Abschluesse, keine
-- gerechneten Kennzahlen: Kmix, DLP, Ampeln und Prognose entstehen beim
-- Lesen. Eine gespeicherte Kennzahl waere nach jeder Korrektur einer Eingabe
-- eine zweite, veraltete Wahrheit.
--
-- Additiv wie jede Migration hier: nur neue Tabellen, nichts an bestehenden
-- Objekten. Produktiver Code, der das Modul nicht kennt, ist unberuehrt
-- (docs/plan-cama-capacity-analysis.md, „Testsystem, nicht Prod").
--
-- Eigentuemer: Taktane. Keine Beruehrung mit LeanPulse-Tabellen (Machine,
-- Shift, …), auch wo sie fachlich aehnlich sind — siehe Plan, „Kernentscheidungen".
--
-- Konventionen dieser Datei:
--   production_day  date      — der Kalendertag 00:00–24:00, unter dem alles
--                               mit Datumsbezug gefuehrt wird.
--   *_start         timestamp — Wanduhrzeit des Werks, bewusst ohne Zeitzone
--                               (src/lib/pp/execution.ts).
--   *_source        text      — woher ein Ist-Wert kam: manual / import / api.
--                               Von Anfang an im Schema, damit eine spaetere
--                               MES-Anbindung keine bestehende Zeile umdeuten muss.
--   kuerzel         text      — Anzeigename neben dem Login, wer etwas
--                               abgeschlossen oder erfasst hat.
--
-- Schreibrecht: editor. Die Rollenteilung des Konzepts (Teamleiter pflegt
-- Status) ist in v1 eine Frage der Oberflaeche, nicht der Policies.

-- ═══════════════════════════════════════════
-- 1) pp_settings — Werkseinstellungen je Organisation
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pp_settings IS
  'Tagesplanung: DLP-Faktor, Schichten, Schichtcodes, Ampel-Schwellen, Regeln der Aktions-Engine — Form siehe src/lib/pp/settings.ts (PpSettings). Fehlende Felder fuellt resolveSettings() aus neutralen Vorgaben; werkseigene Konstanten stehen nur hier, nie im Code.';

DROP TRIGGER IF EXISTS set_pp_settings_updated_at ON public.pp_settings;
CREATE TRIGGER set_pp_settings_updated_at
  BEFORE UPDATE ON public.pp_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════
-- 2) pp_machines — Maschinen, optional an einer Linie
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_machines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_id         uuid REFERENCES public.production_lines(id) ON DELETE SET NULL,
  code            text NOT NULL,
  team            text,
  color           text,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_machines_code_unique UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_pp_machines_line_id ON public.pp_machines USING btree (line_id);

COMMENT ON COLUMN public.pp_machines.code IS
  'Maschinenbezeichnung, wie sie im Ruestplan-Export steht — der Schluessel beim Import, deshalb je Organisation eindeutig.';
COMMENT ON COLUMN public.pp_machines.line_id IS
  'Verknuepfung auf die CAMA-Linie. SET NULL: Faellt die Linie weg, bleibt die Maschine samt Historie.';

DROP TRIGGER IF EXISTS set_pp_machines_updated_at ON public.pp_machines;
CREATE TRIGGER set_pp_machines_updated_at
  BEFORE UPDATE ON public.pp_machines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════
-- 3) pp_plans / pp_plan_items — der Tagesplan
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_day        date NOT NULL,
  production_day  date NOT NULL,
  source_name     text,
  pv_plan         numeric,
  ut_forecast     numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_plans_day_unique UNIQUE (organization_id, production_day)
);

COMMENT ON COLUMN public.pp_plans.plan_day IS
  'Plandatum aus dem Dateiinhalt (nicht dem Dateinamen). In der Woche ab Sonntag 22:00 laeuft es dem Produktionstag einen Tag voraus.';
COMMENT ON COLUMN public.pp_plans.ut_forecast IS
  'Die Prognose, die beim Speichern des Plans galt — eingefroren, damit der Tagesabschluss gegen das misst, was der Planer gesehen hat, nicht gegen eine spaeter neu gerechnete Zahl.';

DROP TRIGGER IF EXISTS set_pp_plans_updated_at ON public.pp_plans;
CREATE TRIGGER set_pp_plans_updated_at
  BEFORE UPDATE ON public.pp_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pp_plan_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id            uuid NOT NULL REFERENCES public.pp_plans(id) ON DELETE CASCADE,
  position           integer NOT NULL DEFAULT 0,
  machine_code       text NOT NULL,
  article            text NOT NULL,
  description        text,
  tool               text,
  quantity           numeric,
  status             text,
  setup_type         text,
  setup_start        timestamp,
  setup_duration_min integer,
  ut_hours           numeric,
  no_program         boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_pp_plan_items_plan_id ON public.pp_plan_items USING btree (plan_id);

COMMENT ON COLUMN public.pp_plan_items.ut_hours IS
  'Vorgabe-UT dieser Position (Zykluszeit × Menge). Grundlage fuer Prognose und Realisierungsgrad; null, wenn keine Zykluszeit vorliegt.';

CREATE OR REPLACE FUNCTION public.pp_plan_org_id(p_plan_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select organization_id from public.pp_plans where id = p_plan_id;
$$;

-- SaaS-Audit 02.10., Punkt 6: Hilfsfunktionen mit SECURITY DEFINER nicht fuer anon.
REVOKE EXECUTE ON FUNCTION public.pp_plan_org_id(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pp_plan_org_id(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════
-- 4) Ist-Erfassung je Produktionstag
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_day_snapshots (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_day  date NOT NULL,
  ut_actual       numeric,
  ut_source       text,
  ot_actual       numeric,
  ot_source       text,
  pv_actual       numeric,
  pv_source       text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, production_day),
  CONSTRAINT pp_day_snapshots_values_check CHECK (
    (ut_actual IS NULL OR ut_actual >= 0) AND (ot_actual IS NULL OR ot_actual >= 0) AND (pv_actual IS NULL OR pv_actual >= 0)
  ),
  CONSTRAINT pp_day_snapshots_source_check CHECK (
    (ut_source IS NULL OR ut_source IN ('manual', 'import', 'api')) AND
    (ot_source IS NULL OR ot_source IN ('manual', 'import', 'api')) AND
    (pv_source IS NULL OR pv_source IN ('manual', 'import', 'api'))
  )
);

DROP TRIGGER IF EXISTS set_pp_day_snapshots_updated_at ON public.pp_day_snapshots;
CREATE TRIGGER set_pp_day_snapshots_updated_at
  BEFORE UPDATE ON public.pp_day_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pp_actual_changeovers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_day  date NOT NULL,
  machine_code    text NOT NULL,
  article         text NOT NULL,
  actual_start    timestamp NOT NULL,
  duration_min    integer,
  source          text NOT NULL DEFAULT 'import',
  CONSTRAINT pp_actual_changeovers_source_check CHECK (source IN ('manual', 'import', 'api'))
);

CREATE INDEX IF NOT EXISTS idx_pp_actual_changeovers_day
  ON public.pp_actual_changeovers USING btree (organization_id, production_day);

-- ═══════════════════════════════════════════
-- 5) Reflexion, Kommentare, Wochenfazit
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_reflections (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_day  date NOT NULL,
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  kuerzel         text,
  closed_at       timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, production_day),
  -- Abschlussregel aus dem Konzept, soweit die Datenbank sie pruefen kann:
  -- kein Abschluss ohne Kuerzel. Dass alle vier Dimensionen beantwortet sind
  -- (bei „Abweichung" mit Kommentar), prueft die Server-Action.
  CONSTRAINT pp_reflections_closed_needs_kuerzel CHECK (closed_at IS NULL OR nullif(btrim(kuerzel), '') IS NOT NULL)
);

COMMENT ON COLUMN public.pp_reflections.answers IS
  'Je Dimension d1..d4 {"status": "ok" | "warn", "comment": text} — dieselbe Form wie im Vorgaengertool.';

DROP TRIGGER IF EXISTS set_pp_reflections_updated_at ON public.pp_reflections;
CREATE TRIGGER set_pp_reflections_updated_at
  BEFORE UPDATE ON public.pp_reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pp_day_comments (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_day  date NOT NULL,
  d1              text,
  d2              text,
  d3              text,
  rb              text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, production_day)
);

DROP TRIGGER IF EXISTS set_pp_day_comments_updated_at ON public.pp_day_comments;
CREATE TRIGGER set_pp_day_comments_updated_at
  BEFORE UPDATE ON public.pp_day_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pp_week_fazit (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  iso_year        smallint NOT NULL,
  iso_week        smallint NOT NULL,
  text            text NOT NULL DEFAULT '',
  kuerzel         text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, iso_year, iso_week),
  CONSTRAINT pp_week_fazit_week_check CHECK (iso_week BETWEEN 1 AND 53)
);

DROP TRIGGER IF EXISTS set_pp_week_fazit_updated_at ON public.pp_week_fazit;
CREATE TRIGGER set_pp_week_fazit_updated_at
  BEFORE UPDATE ON public.pp_week_fazit
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════
-- 6) pp_shift_roster — Schichtplan, eine Zeile je Person und Woche
-- ═══════════════════════════════════════════
-- Kuerzel statt Namen; Abwesenheitsgruende (krank, Ferien) kommen nicht an —
-- normalizeRosterCode bildet sie vor dem Speichern auf „abwesend" ab.
CREATE TABLE IF NOT EXISTS public.pp_shift_roster (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kuerzel         text NOT NULL,
  team            text,
  role            text,
  week_sunday     date NOT NULL,
  codes           text[] NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_shift_roster_unique UNIQUE (organization_id, kuerzel, week_sunday),
  CONSTRAINT pp_shift_roster_seven_days CHECK (cardinality(codes) = 7),
  CONSTRAINT pp_shift_roster_sunday CHECK (extract(isodow FROM week_sunday) = 7)
);

COMMENT ON COLUMN public.pp_shift_roster.role IS
  'Rollen-Code aus pp_settings (z. B. Einrichter); bestimmt, mit welchem Gewicht die Stunden in die geplante OT eingehen (plannedOtHoursForDay). NULL = erste Rolle der Einstellungen.';

COMMENT ON COLUMN public.pp_shift_roster.codes IS
  'Sieben Schichtcodes, Sonntag zuerst wie die Schichtplan-Vorlage; NULL-Element = kein Eintrag. Bedeutung der Codes in pp_settings.';

DROP TRIGGER IF EXISTS set_pp_shift_roster_updated_at ON public.pp_shift_roster;
CREATE TRIGGER set_pp_shift_roster_updated_at
  BEFORE UPDATE ON public.pp_shift_roster
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Zuordnung Name → Kuerzel fuer den Schichtplan-Import. Gespeichert ist der
-- Hash des Namens (src/lib/pp/import/people.ts), nicht der Name: Die
-- Datenbank erkennt einen Namen wieder, ohne ihn zu enthalten.
CREATE TABLE IF NOT EXISTS public.pp_person_aliases (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name_hash       text NOT NULL,
  kuerzel         text NOT NULL,
  role            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, name_hash),
  CONSTRAINT pp_person_aliases_hash_check CHECK (name_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT pp_person_aliases_kuerzel_check CHECK (btrim(kuerzel) <> '')
);

COMMENT ON COLUMN public.pp_person_aliases.role IS
  'Rolle der Person (pp_settings.roles) — haengt an der Person, nicht an der Woche, und wird beim Import in pp_shift_roster.role uebernommen.';

-- ═══════════════════════════════════════════
-- 7) pp_no_program — Auftraege ohne Maschinenprogramm
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pp_no_program (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  article         text NOT NULL,
  machine_code    text NOT NULL,
  description     text,
  tool            text,
  first_seen      date NOT NULL,
  last_seen       date NOT NULL,
  occurrences     integer NOT NULL DEFAULT 1,
  kuerzel         text,
  status          text NOT NULL DEFAULT 'open',
  note            text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Ein Fall je Artikel und Maschine: Wiederholungen zaehlen hoch, statt die
  -- Liste zu verdoppeln — so bleiben chronisch fehlende Programme sichtbar.
  CONSTRAINT pp_no_program_unique UNIQUE (organization_id, article, machine_code),
  CONSTRAINT pp_no_program_status_check CHECK (status IN ('open', 'done')),
  CONSTRAINT pp_no_program_seen_check CHECK (last_seen >= first_seen AND occurrences >= 1)
);

DROP TRIGGER IF EXISTS set_pp_no_program_updated_at ON public.pp_no_program;
CREATE TRIGGER set_pp_no_program_updated_at
  BEFORE UPDATE ON public.pp_no_program
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════
-- 8) Massnahmen und Erkenntnisse
-- ═══════════════════════════════════════════
-- Eigene Tabelle statt capacity_actions: Dort ist line_id Pflicht und die
-- RLS haengt an der Linie (line_org_id) — eine Massnahme aus der
-- Tagesplanung („Schichtuebergabe klaeren") hat oft keine Linie. Das
-- gemeinsame Register aus dem Plan bleibt das Ziel; es zusammenzufuehren
-- heisst capacity_actions umzubauen, deren Migration noch nicht live ist
-- (SaaS-Audit 02.10., Punkt 3) — eine eigene Entscheidung, nicht Teil dieser.
CREATE TABLE IF NOT EXISTS public.pp_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_id         uuid REFERENCES public.production_lines(id) ON DELETE SET NULL,
  title           text NOT NULL,
  origin          text,
  rule_id         text,
  owner_kuerzel   text,
  due_date        date,
  status          text NOT NULL DEFAULT 'open',
  note            text,
  created_kuerzel text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_actions_status_check CHECK (status IN ('open', 'in_progress', 'done'))
);

CREATE INDEX IF NOT EXISTS idx_pp_actions_organization_id ON public.pp_actions USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_pp_actions_line_id ON public.pp_actions USING btree (line_id);

COMMENT ON COLUMN public.pp_actions.origin IS
  'Herkunft als Anzeige, z. B. "KW41 · D2" oder "Manuell erfasst". rule_id haelt zusaetzlich die Regel der Aktions-Engine (src/lib/pp/actionEngine.ts), wenn der Vorschlag von dort kam.';

DROP TRIGGER IF EXISTS set_pp_actions_updated_at ON public.pp_actions;
CREATE TRIGGER set_pp_actions_updated_at
  BEFORE UPDATE ON public.pp_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pp_learnings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  noted_on        date NOT NULL DEFAULT current_date,
  text            text NOT NULL,
  category        text NOT NULL DEFAULT 'general',
  kuerzel         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_learnings_category_check CHECK (category IN ('personnel', 'setup', 'ut', 'execution', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_pp_learnings_organization_id ON public.pp_learnings USING btree (organization_id, noted_on);

-- ═══════════════════════════════════════════
-- 9) RLS — Mitglieder lesen, Editoren schreiben
-- ═══════════════════════════════════════════
-- Dieselbe Kette wie production_lines: has_org_role(organization_id, …).
-- Schleife statt elf gleichlautender Bloecke; die Policy-Namen tragen den
-- Tabellennamen, damit sie im Katalog eindeutig bleiben.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pp_settings', 'pp_machines', 'pp_plans', 'pp_day_snapshots', 'pp_actual_changeovers',
    'pp_reflections', 'pp_day_comments', 'pp_week_fazit', 'pp_shift_roster', 'pp_person_aliases', 'pp_no_program',
    'pp_actions', 'pp_learnings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'members can view ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (has_org_role(organization_id, %L))',
      'members can view ' || t, t, 'viewer');
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'editors can write ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (has_org_role(organization_id, %L)) WITH CHECK (has_org_role(organization_id, %L))',
      'editors can write ' || t, t, 'editor', 'editor');
  END LOOP;
END $$;

-- pp_plan_items hat keine eigene organization_id, sie erbt ueber den Plan.
ALTER TABLE public.pp_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view pp_plan_items" ON public.pp_plan_items;
CREATE POLICY "members can view pp_plan_items"
  ON public.pp_plan_items FOR SELECT
  USING (has_org_role(pp_plan_org_id(plan_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write pp_plan_items" ON public.pp_plan_items;
CREATE POLICY "editors can write pp_plan_items"
  ON public.pp_plan_items FOR ALL
  USING (has_org_role(pp_plan_org_id(plan_id), 'editor'))
  WITH CHECK (has_org_role(pp_plan_org_id(plan_id), 'editor'));
