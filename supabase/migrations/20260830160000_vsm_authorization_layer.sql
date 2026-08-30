-- Die Autorisierungsschicht des VSM Builders unter Versionierung (2026-08-30)
--
-- Erste Migration dieses Projekts ueberhaupt. Bis heute existierte das gesamte
-- Schema nur in der Produktivdatenbank — genau die Konstellation, die am
-- 16.08. die Registrierung aller drei Produkte lahmgelegt hat: eine Migration
-- auf der MES-Seite aenderte `organizations`, und der Trigger, der davon
-- abhing, war nirgends sichtbar.
--
-- Der VSM Builder greift ausschliesslich als `authenticated` ueber PostgREST
-- zu, hat also keine API mit Owner-Rechten, die RLS umgehen koennte. Ohne
-- diese Policies ist die Anwendung tot — nicht unsicher, sondern funktionslos.
-- Deshalb steht die Autorisierung vor dem Tabellen-Baseline: sie ist der Teil,
-- dessen Verlust am teuersten waere, und sie laesst sich exakt aus dem
-- Katalog rekonstruieren.
--
-- Eigentuemergrenze (siehe supabase/README.md): diese Datei fasst nur Objekte
-- an, die dem VSM Builder gehoeren. `has_org_role()` und die Policies auf
-- `organizations`/`organization_members` liegen in den Prisma-Migrationen von
-- LeanPulse Industrial, weil dort die Tabellen liegen —
-- 20260830160000_shared_authorization_layer. `consulting_leads` gehoert der
-- Landing-Page und wird hier ebenfalls nicht angefasst.
--
-- Idempotent: alle Objekte existieren produktiv bereits, diese Migration
-- schreibt den Ist-Zustand fest.

-- ═══════════════════════════════════════════
-- 1) Hilfsfunktionen
-- ═══════════════════════════════════════════
-- Alle Kindtabellen haengen ueber `project_id` am Projekt und erben dessen
-- Organisation. Ohne diese Funktion muesste jede Policy einen eigenen
-- Subselect auf `projects` machen — und der wuerde seinerseits an der
-- projects-Policy haengen. SECURITY DEFINER loest beides: eine Auswertung,
-- keine verschachtelte Rechtepruefung.
CREATE OR REPLACE FUNCTION public.project_org_id(p_project_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select organization_id from public.projects where id = p_project_id;
$$;

-- Bewusst *ohne* SECURITY DEFINER: der Trigger schreibt nur in NEW, er liest
-- nichts, was RLS umgehen muesste.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════
-- 2) Projekte — die Wurzel der Rechtekette
-- ═══════════════════════════════════════════
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view org projects" ON public.projects;
CREATE POLICY "members can view org projects"
  ON public.projects FOR SELECT
  USING (has_org_role(organization_id, 'viewer'));

DROP POLICY IF EXISTS "editors can write org projects" ON public.projects;
CREATE POLICY "editors can write org projects"
  ON public.projects FOR ALL
  USING (has_org_role(organization_id, 'editor'))
  WITH CHECK (has_org_role(organization_id, 'editor'));

-- ═══════════════════════════════════════════
-- 3) Kindtabellen des Projekts
-- ═══════════════════════════════════════════
-- Identisches Muster fuer alle sieben: lesen ab 'viewer', schreiben ab
-- 'editor', beides ueber die Organisation des Projekts. Bewusst ausgeschrieben
-- statt per DO-Schleife generiert — eine Policy, die man nicht lesen kann,
-- prueft man auch nicht nach.

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view processes" ON public.processes;
CREATE POLICY "members can view processes"
  ON public.processes FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write processes" ON public.processes;
CREATE POLICY "editors can write processes"
  ON public.processes FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.inventory_buffers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view inventory buffers" ON public.inventory_buffers;
CREATE POLICY "members can view inventory buffers"
  ON public.inventory_buffers FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write inventory buffers" ON public.inventory_buffers;
CREATE POLICY "editors can write inventory buffers"
  ON public.inventory_buffers FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view scenarios" ON public.scenarios;
CREATE POLICY "members can view scenarios"
  ON public.scenarios FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write scenarios" ON public.scenarios;
CREATE POLICY "editors can write scenarios"
  ON public.scenarios FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.spaghetti_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view spaghetti layouts" ON public.spaghetti_layouts;
CREATE POLICY "members can view spaghetti layouts"
  ON public.spaghetti_layouts FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write spaghetti layouts" ON public.spaghetti_layouts;
CREATE POLICY "editors can write spaghetti layouts"
  ON public.spaghetti_layouts FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view reports" ON public.reports;
CREATE POLICY "members can view reports"
  ON public.reports FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write reports" ON public.reports;
CREATE POLICY "editors can write reports"
  ON public.reports FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.historical_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view historical metrics" ON public.historical_metrics;
CREATE POLICY "members can view historical metrics"
  ON public.historical_metrics FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write historical metrics" ON public.historical_metrics;
CREATE POLICY "editors can write historical metrics"
  ON public.historical_metrics FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

ALTER TABLE public.benchmark_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view benchmark data" ON public.benchmark_data;
CREATE POLICY "members can view benchmark data"
  ON public.benchmark_data FOR SELECT
  USING (has_org_role(project_org_id(project_id), 'viewer'));

DROP POLICY IF EXISTS "editors can write benchmark data" ON public.benchmark_data;
CREATE POLICY "editors can write benchmark data"
  ON public.benchmark_data FOR ALL
  USING (has_org_role(project_org_id(project_id), 'editor'))
  WITH CHECK (has_org_role(project_org_id(project_id), 'editor'));

-- ═══════════════════════════════════════════
-- 4) Aktivitaetsprotokoll
-- ═══════════════════════════════════════════
-- Haengt an der Organisation, nicht am Projekt (project_id ist nullable).
-- Kein UPDATE und kein DELETE, bewusst: ein Protokoll, das sein Urheber
-- nachtraeglich aendern kann, ist keines. Die CHECK-Bedingung erzwingt
-- zusaetzlich, dass niemand einen Eintrag im Namen eines anderen schreibt.
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view org activity logs" ON public.activity_logs;
CREATE POLICY "members can view org activity logs"
  ON public.activity_logs FOR SELECT
  USING (has_org_role(organization_id, 'viewer'));

DROP POLICY IF EXISTS "members can log their own actions" ON public.activity_logs;
CREATE POLICY "members can log their own actions"
  ON public.activity_logs FOR INSERT
  WITH CHECK (has_org_role(organization_id, 'viewer') AND user_id = auth.uid());

-- ═══════════════════════════════════════════
-- 5) Branchenreferenz
-- ═══════════════════════════════════════════
-- Nicht mandantengebunden: dieselben Vergleichswerte fuer alle. Lesen darf
-- jeder angemeldete Nutzer, schreiben niemand ueber PostgREST — die Pflege
-- laeuft ueber Migrationen und supabase/seed.sql.
ALTER TABLE public.benchmark_reference ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read benchmark reference data" ON public.benchmark_reference;
CREATE POLICY "authenticated users can read benchmark reference data"
  ON public.benchmark_reference FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════
-- 6) updated_at-Trigger
-- ═══════════════════════════════════════════
-- Nur diese drei Tabellen haben eine updated_at-Spalte.

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_processes_updated_at ON public.processes;
CREATE TRIGGER set_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_spaghetti_layouts_updated_at ON public.spaghetti_layouts;
CREATE TRIGGER set_spaghetti_layouts_updated_at
  BEFORE UPDATE ON public.spaghetti_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
