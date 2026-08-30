import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import VSMCanvasLoader from '@/components/VSMEditor/VSMCanvasLoader'
import BenchmarkPanel from '@/components/VSMEditor/BenchmarkPanel'
import ScenarioSwitcher from '@/components/VSMEditor/ScenarioSwitcher'
import ScenarioMetaPanel from '@/components/VSMEditor/ScenarioMetaPanel'

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ scenario?: string; error?: string }>
}) {
  const { projectId } = await params
  const { scenario: scenarioParam, error } = await searchParams
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

  let processesQuery = supabase.from('processes').select('*').eq('project_id', projectId)
  processesQuery = scenarioId ? processesQuery.eq('scenario_id', scenarioId) : processesQuery.is('scenario_id', null)
  const { data: processes } = await processesQuery.order('created_at', { ascending: true })

  let buffersQuery = supabase.from('inventory_buffers').select('*').eq('project_id', projectId)
  buffersQuery = scenarioId ? buffersQuery.eq('scenario_id', scenarioId) : buffersQuery.is('scenario_id', null)
  const { data: buffers } = await buffersQuery.order('created_at', { ascending: true })

  const { data: benchmarkReferences } = await supabase.from('benchmark_reference').select('*')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* [Live-Test 2026-08-16, Smartphone] Ohne flex-wrap standen Titel und
          die beiden Aktions-Links zwingend in einer Zeile — auf 375 px lief
          "Szenarien vergleichen" aus dem Bild. Umbruch statt Verkleinern:
          die Beschriftungen sind Fachbegriffe, abgekürzt versteht sie niemand. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
            ← Dashboard
          </Link>
          <span className="mx-1.5 text-xs text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            VSM Builder
          </span>
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{project.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeScenario && (
            <Link
              href={`/editor/${projectId}/future-state?scenario=${activeScenario.id}`}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Future-State-Wizard
            </Link>
          )}
          <Link
            href={`/editor/${projectId}/compare`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Szenarien vergleichen
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <ScenarioSwitcher projectId={projectId} scenarios={scenarios ?? []} activeScenarioId={scenarioId} />
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {activeScenario && <ScenarioMetaPanel projectId={projectId} scenario={activeScenario} />}
      </div>

      <VSMCanvasLoader
        project={project}
        scenarioId={scenarioId}
        initialProcesses={processes ?? []}
        initialBuffers={buffers ?? []}
      />
      <BenchmarkPanel processes={processes ?? []} references={benchmarkReferences ?? []} />
    </div>
  )
}
