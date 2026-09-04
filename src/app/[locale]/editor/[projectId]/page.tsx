import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import VSMCanvasLoader from '@/components/VSMEditor/VSMCanvasLoader'
import ScenarioSwitcher from '@/components/VSMEditor/ScenarioSwitcher'
import ScenarioMetaPanel from '@/components/VSMEditor/ScenarioMetaPanel'
import { buttonSecondary } from '@/components/ui/buttons'
import type { ComparisonState } from '@/lib/vsm/scenarioComparison'

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ scenario?: string; error?: string }>
}) {
  const { projectId } = await params
  const { scenario: scenarioParam, error } = await searchParams
  const t = await getTranslations('Editor')
  const tNav = await getTranslations('Nav')
  const tWizard = await getTranslations('Wizard')
  const tScenario = await getTranslations('Scenario')
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  // RLS hides projects outside the caller's org, so a missing row here
  // means either it never existed or the user has no access — 404 either way.
  if (!project) notFound()

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // A scenario param that doesn't belong to this project (stale link, typo)
  // silently falls back to the current/live state rather than 404ing.
  const activeScenario = scenarioParam ? (scenarios ?? []).find((s) => s.id === scenarioParam) : undefined
  const scenarioId = activeScenario?.id ?? null

  // [Bedienbarkeitspruefung 2026-09-03, B16] Frueher zwei nach scenario_id
  // gefilterte Abfragen. Jetzt einmal alles zum Projekt und danach im
  // Speicher aufgeteilt: dieselbe Zahl von Abfragen, aber die zweite
  // PDF-Seite braucht ohnehin jeden Zustand, und die Vergleichsseite macht
  // es seit jeher genauso.
  const { data: allProcesses } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const { data: allBuffers } = await supabase
    .from('inventory_buffers')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const processes = (allProcesses ?? []).filter((p) => p.scenario_id === scenarioId)
  const buffers = (allBuffers ?? []).filter((b) => b.scenario_id === scenarioId)

  // Ist-Zustand zuerst — comparisonTable rechnet "freigesetztes Kapital"
  // gegen die erste Spalte.
  const comparisonStates: ComparisonState[] = [
    {
      id: null,
      label: tScenario('currentState'),
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === null)
        .map((p) => ({ cycleTime: p.cycle_time, operatorCount: p.operator_count, oee: p.oee, wip: p.wip ?? undefined })),
      buffers: (allBuffers ?? []).filter((b) => b.scenario_id === null).map((b) => ({ wipCount: b.wip_count })),
    },
    ...(scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      label: `${scenario.type ?? '?'} · ${scenario.name ?? ''}`,
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === scenario.id)
        .map((p) => ({ cycleTime: p.cycle_time, operatorCount: p.operator_count, oee: p.oee, wip: p.wip ?? undefined })),
      buffers: (allBuffers ?? []).filter((b) => b.scenario_id === scenario.id).map((b) => ({ wipCount: b.wip_count })),
    })),
  ]

  const { data: benchmarkReferences } = await supabase.from('benchmark_reference').select('*')

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* [Live-Test 2026-08-16, Smartphone] Ohne flex-wrap standen Titel und
          die beiden Aktions-Links zwingend in einer Zeile — auf 375 px lief
          "Szenarien vergleichen" aus dem Bild. Umbruch statt Verkleinern:
          die Beschriftungen sind Fachbegriffe, abgekürzt versteht sie niemand. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            {tNav('backToDashboard')}
          </Link>
          <span className="mx-1.5 text-xs text-zinc-600">·</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <h1 className="text-lg font-semibold text-zinc-950">{project.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* [Bedienbarkeitspruefung 2026-09-03, B7] Der Knopf haengt nicht
              mehr am aktiven Szenario. Wer ein Projekt neu anlegt, hat noch
              keines — und sah damit ausgerechnet den gefuehrten Weg nie, der
              ihm die Methodik abnimmt, die er nicht auswendig kann. Ohne
              Szenario fuehrt der Knopf auf die Wizard-Seite, die erklaert,
              wozu ein Szenario da ist, und gleich eines anlegen laesst. Das
              ist der erste Schritt des Weges, nicht seine Voraussetzung. */}
          <Link
            href={
              activeScenario
                ? `/editor/${projectId}/future-state?scenario=${activeScenario.id}`
                : `/editor/${projectId}/future-state`
            }
            className={buttonSecondary}
          >
            {tWizard('title')}
          </Link>
          <Link
            href={`/editor/${projectId}/compare`}
            className={buttonSecondary}
          >
            {t('compareScenarios')}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <ScenarioSwitcher projectId={projectId} scenarios={scenarios ?? []} activeScenarioId={scenarioId} />
        {error && (
          <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {activeScenario && (
          <ScenarioMetaPanel
            projectId={projectId}
            scenario={activeScenario}
            usedTypes={(scenarios ?? []).map((s) => s.type)}
            currency={project.currency}
          />
        )}
      </div>

      <VSMCanvasLoader
        project={project}
        scenarioId={scenarioId}
        scenarioName={activeScenario?.name ?? null}
        initialProcesses={processes}
        initialBuffers={buffers}
        benchmarkReferences={benchmarkReferences ?? []}
        comparisonStates={comparisonStates}
      />
    </div>
  )
}
