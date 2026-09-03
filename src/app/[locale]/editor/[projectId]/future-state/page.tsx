import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveFutureStateQuestions, type FutureStateInput } from '@/lib/vsm/futureStateQuestions'
import NewScenarioDisclosure from '@/components/VSMEditor/NewScenarioDisclosure'
import { buttonSecondary } from '@/components/ui/buttons'

// Nur die Zuordnung Status -> Uebersetzungsschluessel; die Texte stehen im
// Namensraum `Wizard`.
const STATUS_KEY: Record<string, string> = {
  answered: 'statusAnswered',
  open: 'statusOpen',
  not_applicable: 'statusNotApplicable',
}

const STATUS_CLASS: Record<string, string> = {
  answered:
    'bg-emerald-50 text-emerald-700',
  open: 'bg-amber-50 text-amber-700',
  not_applicable: 'bg-zinc-100 text-zinc-500',
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
  const t = await getTranslations('Wizard')
  const tFs = await getTranslations('FutureState')
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
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <Link href={`/editor/${projectId}`} className="text-xs text-zinc-500 hover:underline">
            {t('backToEditor')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
          <p className="mt-4 rounded-control bg-zinc-100 px-3 py-3 text-sm text-zinc-600">
            {t('noScenario')}
          </p>
          <div className="mt-4">
            <NewScenarioDisclosure projectId={projectId} usedTypes={(scenarios ?? []).map((s) => s.type)} />
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
      oee: p.oee,
      wip: p.wip ?? undefined,
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
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/editor/${projectId}?scenario=${activeScenario.id}`}
          className="text-xs text-zinc-500 hover:underline"
        >
          {t('backToEditor')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
          {t('titleWithScenario', {
            type: activeScenario.type ?? '',
            name: activeScenario.name ?? '',
          })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t('progress', { answered: answeredCount })}
        </p>

        <ol className="mt-6 flex flex-col gap-2">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/editor/${projectId}/future-state/${q.id}?scenario=${activeScenario.id}`}
                className="flex items-start justify-between gap-4 rounded-surface border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                <div>
                  <p className="text-xs font-medium text-zinc-500">{t('questionLabel', { id: q.id })}</p>
                  <p className="mt-0.5 font-medium text-zinc-950">{tFs(`questions.${q.questionKey}`)}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tFs(`summary.${q.summaryKey}`, q.summaryValues)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-control px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[q.status]}`}
                >
                  {t(STATUS_KEY[q.status])}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/editor/${projectId}/compare`}
            className={buttonSecondary}
          >
            {t('toCompare')}
          </Link>
          <NewScenarioDisclosure
            projectId={projectId}
            sourceScenarioId={activeScenario.id}
            label={t('newIterationFrom')}
            usedTypes={(scenarios ?? []).map((s) => s.type)}
          />
        </div>
      </div>
    </div>
  )
}
