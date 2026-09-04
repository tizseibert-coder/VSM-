-- Der Tabellen-Baseline des VSM Builders (nachgetragen am 04.09.2026)
--
-- Bis heute stand in supabase/README.md unter "Was noch fehlt": `CREATE TABLE`
-- fuer die zehn eigenen Tabellen existiert nirgends, aus diesem Repository
-- laesst sich keine Datenbank von Null aufbauen. Das ist diese Datei.
--
-- Rekonstruiert aus dem Katalog der Produktivdatenbank (Spalten, Vorgaben,
-- Constraints, Indizes, Kommentare), nicht aus `supabase db pull`: Der zieht
-- das *ganze* public-Schema, also auch die Prisma-Tabellen von LeanPulse
-- Industrial, und die haette man anschliessend von Hand wieder
-- herausschneiden muessen. Beide Systeme wuerden sonst dieselben Objekte
-- beanspruchen — genau die Konstellation, die am 16.08. die Registrierung
-- aller drei Produkte lahmgelegt hat. Gezielt abzufragen war der kuerzere und
-- der sicherere Weg.
--
-- Idempotent (`IF NOT EXISTS` durchgehend): Produktiv stehen alle zehn
-- Tabellen laengst, dort ist diese Migration ein Leerlauf. Ihr Zweck ist die
-- leere Datenbank.
--
-- Die Reihenfolge ist die der Fremdschluessel: projects, dann scenarios,
-- dann processes, dann die Puffer, dann der Rest.
--
-- ─────────────────────────────────────────────────────────────────────
-- Was diese Datei NICHT anlegt
-- ─────────────────────────────────────────────────────────────────────
-- `organizations` und `auth.users` gehoeren nicht dem VSM Builder (siehe
-- supabase/README.md, "Die Aufteilung"). `projects.organization_id` und die
-- beiden Spalten von `activity_logs` zeigen aber dorthin. Ein Baseline, der
-- fremde Tabellen mit anlegt, waere eine Eigentumsverletzung; einer, der die
-- Fremdschluessel weglaesst, waere eine Luege ueber das Schema.
--
-- Deshalb der dritte Weg: Die Migration prueft die Voraussetzung und bricht
-- mit einer Meldung ab, die sagt, was zu tun ist. Auf einer frischen
-- Datenbank laeuft also zuerst `prisma migrate deploy` aus
-- D:\LeanPulse Industrial\apps\api, danach diese hier.
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'Der Tabellen-Baseline des VSM Builders setzt public.organizations voraus (Eigentuemer: Prisma / LeanPulse Industrial). Zuerst `prisma migrate deploy` aus apps/api laufen lassen, dann diese Migration. Siehe supabase/README.md.';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION
      'Der Tabellen-Baseline des VSM Builders setzt auth.users voraus (Eigentuemer: Supabase). Auf einer nackten Postgres-Instanz ohne Supabase-Auth fehlt dieses Schema.';
  END IF;
END
$$;

-- ═══════════════════════════════════════════
-- projects — die Wurzel. Alles andere haengt daran.
-- ═══════════════════════════════════════════
-- Der Name ist je Organisation eindeutig: Zwei Wertstroeme derselben Firma
-- mit demselben Namen waeren in der Projektliste nicht zu unterscheiden.
CREATE TABLE IF NOT EXISTS public.projects (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  description               text,
  company                   text,
  product_name              text,
  annual_throughput         integer,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- Beschriftungen der Randsymbole. Nicht null mit deutscher Vorgabe: Ein
  -- Wertstrom ohne Lieferant und Kunde ist keiner.
  supplier_name             text NOT NULL DEFAULT 'Lieferant',
  customer_name             text NOT NULL DEFAULT 'Kunde',
  erp_label                 text NOT NULL DEFAULT 'Produktionssteuerung (ERP)',
  available_minutes_per_day double precision NOT NULL DEFAULT 480,
  pitch_minutes             numeric,
  piece_value               numeric,
  currency                  text NOT NULL DEFAULT 'EUR',
  CONSTRAINT projects_organization_id_name_key UNIQUE (organization_id, name)
);

COMMENT ON COLUMN public.projects.available_minutes_per_day IS
  'Verfügbare Produktionszeit in Minuten pro Tag, für die Taktzeit-Berechnung (Taktzeit = verfügbare Zeit / Tagesbedarf). Default 480 = ein 8h-Schicht, entspricht dem bisherigen fest verdrahteten SHIFT_MINUTES-Wert.';

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects USING btree (organization_id);

-- ═══════════════════════════════════════════
-- scenarios — je Szenario eine volle Kopie des Wertstroms
-- ═══════════════════════════════════════════
-- `parent_scenario_id` traegt die Abstammung: eine zweite Iteration, die auf
-- einem Szenario aufsetzt statt wieder beim Ist-Zustand anzufangen.
CREATE TABLE IF NOT EXISTS public.scenarios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type                  varchar(10),
  name                  text,
  description           text,
  wip_reduction_percent integer,
  -- Der Spaltenname sagt Franken, angezeigt wird die Waehrung des Projekts
  -- (projects.currency). Umbenennen waere eine Migration, die nichts kann,
  -- was die Anzeige nicht schon kann.
  investment_chf        integer,
  payback_months        double precision,
  risk_level            varchar(20),
  created_at            timestamptz NOT NULL DEFAULT now(),
  parent_scenario_id    uuid REFERENCES public.scenarios(id) ON DELETE SET NULL,
  -- Die Literale stehen als `character varying` da, weil die Spalte varchar
  -- ist und Postgres den Ausdruck produktiv genau so ablegt. Mit
  -- text-Literalen waere die Bedingung dieselbe, ihre gespeicherte Definition
  -- aber eine andere — und ein spaeterer `db diff` meldete einen Unterschied,
  -- den es nicht gibt.
  --
  -- Nur unter Postgres 16 sieht man das trotzdem: Dort wird
  -- `(ARRAY[...]::varchar[])::text[]` beim Ablegen in Element-Casts
  -- umgeschrieben, unter 17 (was Supabase fahrt) bleibt die Form stehen. Die
  -- Bedingung prueft in beiden Faellen dasselbe. Wer den Baseline lokal gegen
  -- eine 16er-Instanz haelt, sieht diesen Unterschied bei vier CHECKs und
  -- sollte ihn nicht wegzukorrigieren versuchen — die Form hier ist die, die
  -- produktiv steht.
  CONSTRAINT scenarios_type_check
    CHECK ((type)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying])::text[]))
);

CREATE INDEX IF NOT EXISTS idx_scenarios_project_id ON public.scenarios USING btree (project_id);

-- ═══════════════════════════════════════════
-- processes — die Stationen der Kette
-- ═══════════════════════════════════════════
-- `scenario_id IS NULL` ist der Ist-Zustand, ein gesetzter Wert die Kopie im
-- Szenario. `origin_process_id` zeigt auf die Zeile, aus der kopiert wurde.
CREATE TABLE IF NOT EXISTS public.processes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  cycle_time        double precision NOT NULL,
  oee               double precision NOT NULL DEFAULT 78,
  wip               integer NOT NULL DEFAULT 0,
  changeover_time   double precision NOT NULL DEFAULT 0,
  classification    varchar(50),
  x                 double precision,
  y                 double precision,
  width             double precision NOT NULL DEFAULT 140,
  height            double precision NOT NULL DEFAULT 100,
  color             text NOT NULL DEFAULT '#10b981',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  scenario_id       uuid REFERENCES public.scenarios(id) ON DELETE CASCADE,
  origin_process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  lane              integer NOT NULL DEFAULT 0,
  operator_count    integer NOT NULL DEFAULT 1,
  -- Der Schrittmacher: genau einer je (Projekt, Szenario). Die Einzigkeit
  -- setzt die Anwendung durch (updateProcess in actions.ts), nicht die
  -- Datenbank — dieselbe Linie wie bei der Waehrung.
  is_pacemaker      boolean NOT NULL DEFAULT false,
  has_heijunka      boolean NOT NULL DEFAULT false,
  kaizen_note       text
);

CREATE INDEX IF NOT EXISTS idx_processes_project_id ON public.processes USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_processes_scenario_id ON public.processes USING btree (scenario_id);
CREATE INDEX IF NOT EXISTS idx_processes_origin_process_id ON public.processes USING btree (origin_process_id);

-- ═══════════════════════════════════════════
-- inventory_buffers — die Kanten zwischen den Stationen
-- ═══════════════════════════════════════════
-- Beide Enden duerfen null sein: Das ist die Kante zum Lieferanten
-- (from_process_id IS NULL) beziehungsweise zum Kunden (to_process_id IS
-- NULL). Ohne diese beiden Randkanten zeichnet die Flaeche keine
-- Versandpfeile.
CREATE TABLE IF NOT EXISTS public.inventory_buffers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  to_process_id   uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  wip_count       integer NOT NULL,
  x               double precision,
  y               double precision,
  buffer_type     varchar(50),
  created_at      timestamptz NOT NULL DEFAULT now(),
  flow_style      varchar(20),
  scenario_id     uuid REFERENCES public.scenarios(id) ON DELETE CASCADE,
  kanban_type     varchar,
  CONSTRAINT inventory_buffers_flow_style_check
    CHECK ((flow_style)::text = ANY ((ARRAY['push'::character varying, 'pull'::character varying, 'shipment'::character varying])::text[])),
  -- Andere Form als die Zeile darueber, und das mit Absicht: Produktiv steht
  -- diese Bedingung als Array *aus* text-Ausdruecken da, nicht als
  -- varchar-Array, das zu text[] gecastet wird. Beides prueft dasselbe.
  CONSTRAINT inventory_buffers_kanban_type_check
    CHECK ((kanban_type)::text = ANY (ARRAY[('production'::character varying)::text, ('transport'::character varying)::text]))
);

COMMENT ON COLUMN public.inventory_buffers.kanban_type IS
  'Icon variant for the withdrawal-pull arrow when buffer_type = supermarket: production kanban vs transport kanban. Null = default (production) rendering. Display-only distinction, not a full kanban-card simulation.';

CREATE INDEX IF NOT EXISTS idx_inventory_buffers_project_id ON public.inventory_buffers USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_buffers_scenario_id ON public.inventory_buffers USING btree (scenario_id);

-- ═══════════════════════════════════════════
-- Die uebrigen sechs
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.spaghetti_layouts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stations               jsonb NOT NULL DEFAULT '[]'::jsonb,
  paths                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  scale_meters_per_pixel double precision NOT NULL DEFAULT 0.1,
  total_distance_meters  double precision,
  background_image_url   text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spaghetti_layouts_project_id ON public.spaghetti_layouts USING btree (project_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pdf_url     text NOT NULL,
  audience    varchar(50),
  report_type varchar(50),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports USING btree (project_id);

CREATE TABLE IF NOT EXISTS public.historical_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  ct               double precision,
  oee              double precision,
  plt              double precision,
  wip              integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historical_metrics_project_id ON public.historical_metrics USING btree (project_id);

-- benchmark_data haelt den Vergleich *eines* Projekts fest,
-- benchmark_reference die Branchenwerte, gegen die verglichen wird — die
-- zweite haengt deshalb an keinem Projekt und wird ueber seed.sql gefuellt.
CREATE TABLE IF NOT EXISTS public.benchmark_data (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  industry     text,
  company_size text,
  metric_name  text NOT NULL,
  your_value   double precision,
  p25          double precision,
  median       double precision,
  p75          double precision,
  percentile   double precision,
  source       varchar(20) NOT NULL DEFAULT 'synthetic',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmark_data_source_check
    CHECK ((source)::text = ANY ((ARRAY['synthetic'::character varying, 'customer_aggregated'::character varying])::text[]))
);

CREATE INDEX IF NOT EXISTS idx_benchmark_data_project_id ON public.benchmark_data USING btree (project_id);

CREATE TABLE IF NOT EXISTS public.benchmark_reference (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry     text NOT NULL,
  company_size text NOT NULL,
  metric_name  text NOT NULL,
  p25          double precision,
  median       double precision,
  p75          double precision,
  source       varchar(20) NOT NULL DEFAULT 'synthetic',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmark_reference_source_check
    CHECK ((source)::text = ANY ((ARRAY['synthetic'::character varying, 'customer_aggregated'::character varying])::text[]))
);

-- Die einzige Tabelle mit zwei Fremdschluesseln nach draussen: auf
-- `organizations` (Prisma) und auf `auth.users` (Supabase). Deshalb steht sie
-- zuletzt, und deshalb prueft der Kopf dieser Datei beide.
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  action          varchar(100) NOT NULL,
  details         jsonb,
  ip_address      inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_organization_id ON public.activity_logs USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);
