import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deriveFutureStateQuestions, type FutureStateInput } from '@/lib/vsm/futureStateQuestions'
import NewScenarioDisclosure from '@/components/VSMEditor/NewScenarioDisclosure'

const STATUS_LABEL: Record<string, string> = {
  answered: 'Beantwortet',
  open: 'Offen',
  not_applicable: 'Noch nicht relevant',
}

const STATUS_CLASS: Record<string, string> = {
  answered:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  open: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  not_applicable: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500',
}

// Übersichtsseite des Future-State-Wizards (docs/plan-future-state-wizard.md).
// Bewusst ohne gespeicherten Fortschritt: der Status jeder der 8 Fragen wird
// bei jedem Aufruf frisch aus den echten Daten abgeleitet
// (futureStateQuestions.ts) — Wiedereintritt und gezieltes Zurückspringen zu
// einer einzelnen Frage sind damit der Normalfall, nicht ein Sonderfall.
export default async function FutureStateOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ scenario?: string }>
}) {
  const { projectId } = await params
  const { scenario: scenarioParam } = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) notFound()

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const activeScenario = scenarioParam ? (scenarios ?? []).find((s) => s.id === scenarioParam) : undefined

  // Der Future State ist per Definition ein Soll-Zustand — ohne ausgewähltes
  // Szenario gibt es nichts, worauf der Wizard schreiben könnte.
  if (!activeScenario) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
        <div className="mx-auto max-w-2xl">
          <Link href={`/editor/${projectId}`} className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
            ← Zurück zum Editor
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Future-State-Wizard</h1>
          <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Der Future-State-Wizard führt durch die 8 Fragen für ein konkretes Szenario. Wähle im Editor ein
            bestehendes Szenario, oder lege zuerst eins an.
          </p>
          <div className="mt-4">
            <NewScenarioDisclosure projectId={projectId} />
          </div>
        </div>
      </div>
    )
  }

  const { data: processes } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .eq('scenario_id', activeScenario.id)
    .order('created_at', { ascending: true })

  const { data: buffers } = await supabase
    .from('inventory_buffers')
    .select('*')
    .eq('project_id', projectId)
    .eq('scenario_id', activeScenario.id)

  const input: FutureStateInput = {
    processes: (processes ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      cycleTime: p.cycle_time,
      operatorCount: p.operator_count,
      isPacemaker: p.is_pacemaker,
      hasHeijunka: p.has_heijunka,
      kaizenNote: p.kaizen_note,
    })),
    buffers: (buffers ?? []).map((b) => ({
      fromProcessId: b.from_process_id,
      toProcessId: b.to_process_id,
      wipCount: b.wip_count,
      bufferType: b.buffer_type,
      flowStyle: b.flow_style,
    })),
    annualThroughput: project.annual_throughput,
    availableMinutesPerDay: project.available_minutes_per_day,
    pitchMinutes: project.pitch_minutes,
  }

  const questions = deriveFutureStateQuestions(input)
  const answeredCount = questions.filter((q) => q.status === 'answered').length

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/editor/${projectId}?scenario=${activeScenario.id}`}
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-500"
        >
          ← Zurück zum Editor
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Future-State-Wizard — {activeScenario.type} · {activeScenario.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {answeredCount} von 8 Fragen beantwortet. Kein fester Ablauf — springe direkt zu jeder Frage, auch mehrfach.
        </p>

        <ol className="mt-6 flex flex-col gap-2">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/editor/${projectId}/future-state/${q.id}?scenario=${activeScenario.id}`}
                className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Frage {q.id}</p>
                  <p className="mt-0.5 font-medium text-zinc-950 dark:text-zinc-50">{q.question}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{q.summary}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[q.status]}`}
                >
                  {STATUS_LABEL[q.status]}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/editor/${projectId}/compare`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Zum Szenario-Vergleich →
          </Link>
          <NewScenarioDisclosure
            projectId={projectId}
            sourceScenarioId={activeScenario.id}
            label="+ Neue Iteration aus diesem Szenario"
          />
        </div>
      </div>
    </div>
  )
}
