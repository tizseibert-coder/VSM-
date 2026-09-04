import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveFutureStateQuestions, type FutureStateInput } from '@/lib/vsm/futureStateQuestions'
import { formatValues } from '@/lib/vsm/numberFormat'
import { TermTooltip } from '@/components/VSMEditor/TermTooltip'
import { WizardSaveButton } from '@/components/wizard/WizardSaveButton'
import { submitTaktTime, submitBuffer, submitPacemaker, submitHeijunka, submitPitch, submitKaizenNote } from '../wizard-actions'

// Nur die Zuordnung Status -> Uebersetzungsschluessel; die Texte stehen im
// Namensraum `Wizard`.
const STATUS_KEY: Record<string, string> = {
  answered: 'statusAnswered',
  open: 'statusOpen',
  not_applicable: 'statusNotApplicable',
}

const STATUS_CLASS: Record<string, string> = {
  answered: 'bg-emerald-50 text-emerald-700',
  open: 'bg-amber-50 text-amber-700',
  not_applicable: 'bg-zinc-100 text-zinc-500',
}

const FIELD_CLASS =
  'mt-1 w-full rounded-control border border-zinc-300 px-2 py-1.5 text-sm'

// Einzelne Frage des Future-State-Wizards. Zeigt beim Öffnen immer den
// aktuell gesetzten Wert als Ausgangszustand (nie ein leeres Formular) —
// Wiedereintritt ist der Normalfall (docs/plan-future-state-wizard.md #3).
export default async function FutureStateQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; questionId: string }>
  searchParams: Promise<{ scenario?: string; saved?: string }>
}) {
  const { projectId, questionId } = await params
  const locale = await getLocale()
  const t = await getTranslations('Wizard')
  const tFs = await getTranslations('FutureState')
  const { scenario: scenarioParam, saved } = await searchParams
  const qid = Number(questionId)
  if (!Number.isInteger(qid) || qid < 1 || qid > 8) notFound()

  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) notFound()

  const { data: scenario } = scenarioParam
    ? await supabase.from('scenarios').select('*').eq('id', scenarioParam).eq('project_id', projectId).maybeSingle()
    : { data: null }
  if (!scenario) notFound()

  const { data: processes } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .eq('scenario_id', scenario.id)
    .order('created_at', { ascending: true })
  const { data: buffers } = await supabase
    .from('inventory_buffers')
    .select('*')
    .eq('project_id', projectId)
    .eq('scenario_id', scenario.id)

  const allProcesses = processes ?? []
  const allBuffers = buffers ?? []
  const nameById = new Map(allProcesses.map((p) => [p.id, p.name]))
  const boundaryLabel = (id: string | null, fallback: string) => (id ? (nameById.get(id) ?? '?') : fallback)

  const input: FutureStateInput = {
    processes: allProcesses.map((p) => ({
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
    buffers: allBuffers.map((b) => ({
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
  const current = questions.find((q) => q.id === qid)!
  const scenarioQuery = `?scenario=${scenario.id}`
  const pacemaker = allProcesses.find((p) => p.is_pacemaker)

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/editor/${projectId}/future-state${scenarioQuery}`}
          className="text-xs text-zinc-500 hover:underline"
        >
          {t('allQuestions')}
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500">{t('questionOf', { id: qid })}</p>
            <h1 className="mt-0.5 text-xl font-semibold text-zinc-950">
              {tFs(`questions.${current.questionKey}`)}
            </h1>
          </div>
          <span className={`shrink-0 rounded-control px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[current.status]}`}>
            {t(STATUS_KEY[current.status])}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          {tFs(
            `summary.${current.summaryKey}`,
            current.summaryValues && formatValues(current.summaryValues, locale)
          )}
        </p>

        {saved === '1' && (
          <p className="mt-4 rounded-control bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}

        <div className="mt-6 rounded-surface border border-zinc-200 bg-white p-4">
          {qid === 1 && (
            <form action={submitTaktTime.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
              <label className="text-xs font-medium text-zinc-600">
                <TermTooltip term="exitRate">{t('q1AnnualDemand')}</TermTooltip>
                <input
                  name="annualThroughput"
                  type="number"
                  min={0}
                  defaultValue={project.annual_throughput ?? ''}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="text-xs font-medium text-zinc-600">
                <TermTooltip term="availableMinutesPerDay">{t('q1AvailableMinutes')}</TermTooltip>
                <input
                  name="availableMinutesPerDay"
                  type="number"
                  min={0}
                  defaultValue={project.available_minutes_per_day}
                  className={FIELD_CLASS}
                />
              </label>
              <WizardSaveButton />
            </form>
          )}

          {qid === 2 &&
            (() => {
              const terminal = allBuffers.find((b) => b.to_process_id === null)
              return (
                <form
                  action={submitBuffer.bind(null, projectId, scenario.id, 2, terminal?.from_process_id ?? null, null)}
                  className="flex flex-col gap-3"
                >
                  <p className="text-xs text-zinc-500">
                    {terminal?.from_process_id
                      ? t('q2HandoverAfter', { name: boundaryLabel(terminal.from_process_id, '?') })
                      : t('q2Handover')}
                  </p>
                  <label className="text-xs font-medium text-zinc-600">
                    {t('q2Kind')}
                    <select name="bufferType" defaultValue={terminal?.buffer_type ?? 'standard'} className={FIELD_CLASS}>
                      <option value="standard">{t('q2DirectShip')}</option>
                      <option value="supermarket">{t('q2Supermarket')}</option>
                      <option value="safety_stock">{t('q2SafetyStock')}</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-zinc-600">
                    <TermTooltip term="wip">{t('q2Stock')}</TermTooltip>
                    <input
                      name="wipCount"
                      type="number"
                      min={0}
                      defaultValue={terminal?.wip_count ?? 0}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <WizardSaveButton />
                </form>
              )
            })()}

          {qid === 3 &&
            (() => {
              const internal = allBuffers.filter((b) => b.from_process_id !== null && b.to_process_id !== null)
              if (internal.length === 0) {
                return (
                  <p className="text-sm text-zinc-500">
                    {t('noInternalConnections')}
                  </p>
                )
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-zinc-500">{t('q3Hint')}</p>
                  {internal.map((b) => (
                    <form
                      key={b.id}
                      action={submitBuffer.bind(null, projectId, scenario.id, 3, b.from_process_id, b.to_process_id)}
                      className="flex flex-wrap items-center gap-3 rounded-surface border border-zinc-100 p-3"
                    >
                      <input type="hidden" name="wipCount" value={b.wip_count} />
                      <p className="mr-auto text-xs font-medium text-zinc-600">
                        {boundaryLabel(b.from_process_id, t('supplier'))} → {boundaryLabel(b.to_process_id, t('customer'))}
                      </p>
                      <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          name="bufferType"
                          value="continuous"
                          defaultChecked={b.buffer_type === 'continuous'}
                        />
                        <TermTooltip term="onePieceFlow">{t('q3ContinuousFlow')}</TermTooltip>
                      </label>
                      <WizardSaveButton />
                    </form>
                  ))}
                </div>
              )
            })()}

          {qid === 4 &&
            (() => {
              // Verbindungen, die bereits als Continuous Flow laufen (Frage 3),
              // haben keinen Puffer zu steuern — hier nicht mehr anfassen.
              const relevant = allBuffers.filter(
                (b) => b.from_process_id !== null && b.to_process_id !== null && b.buffer_type !== 'continuous'
              )
              const continuousCount = allBuffers.filter(
                (b) => b.from_process_id !== null && b.to_process_id !== null && b.buffer_type === 'continuous'
              ).length
              if (relevant.length === 0 && continuousCount === 0) {
                return (
                  <p className="text-sm text-zinc-500">
                    {t('noInternalConnections')}
                  </p>
                )
              }
              if (relevant.length === 0) {
                return (
                  <p className="text-sm text-zinc-500">
                    {t('q4AllContinuous')}
                  </p>
                )
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-zinc-500">
                    {t('q4Hint')}
                  </p>
                  {relevant.map((b) => (
                    <form
                      key={b.id}
                      action={submitBuffer.bind(null, projectId, scenario.id, 4, b.from_process_id, b.to_process_id)}
                      className="flex flex-wrap items-end gap-2 rounded-surface border border-zinc-100 p-3"
                    >
                      <p className="mr-auto w-full text-xs font-medium text-zinc-600">
                        {boundaryLabel(b.from_process_id, t('supplier'))} → {boundaryLabel(b.to_process_id, t('customer'))}
                      </p>
                      <label className="text-xs text-zinc-500">
                        <TermTooltip term="bufferType">{t('q4Type')}</TermTooltip>
                        <select name="bufferType" defaultValue={b.buffer_type ?? 'standard'} className={FIELD_CLASS}>
                          <option value="standard">{t('q4Standard')}</option>
                          <option value="supermarket">{t('q4Supermarket')}</option>
                          <option value="fifo">{t('q4Fifo')}</option>
                        </select>
                      </label>
                      <label className="text-xs text-zinc-500">
                        <TermTooltip term="wip">{t('q4Wip')}</TermTooltip>
                        <input name="wipCount" type="number" min={0} defaultValue={b.wip_count} className={FIELD_CLASS} />
                      </label>
                      <WizardSaveButton />
                    </form>
                  ))}
                </div>
              )
            })()}

          {qid === 5 &&
            (allProcesses.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('noProcesses')}</p>
            ) : (
              <form action={submitPacemaker.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
                <label className="text-xs font-medium text-zinc-600">
                  <TermTooltip term="pacemaker">{t('q5Pacemaker')}</TermTooltip>
                  <select name="processId" defaultValue={pacemaker?.id ?? ''} className={FIELD_CLASS}>
                    <option value="" disabled>
                      {t('q5ChooseProcess')}
                    </option>
                    {allProcesses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <WizardSaveButton label={t('q5SetPacemaker')} />
              </form>
            ))}

          {qid === 6 &&
            (!pacemaker ? (
              <p className="text-sm text-zinc-500">
                {t('q6NeedsPacemaker')}
              </p>
            ) : (
              <form
                action={submitHeijunka.bind(null, projectId, scenario.id, pacemaker.id)}
                className="flex flex-col gap-3"
              >
                <p className="text-xs text-zinc-500">{t('q6PacemakerIs', { name: pacemaker.name })}</p>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" name="hasHeijunka" defaultChecked={pacemaker.has_heijunka} />
                  <TermTooltip term="heijunka">{t('q6HeijunkaActive')}</TermTooltip>
                </label>
                <WizardSaveButton />
              </form>
            ))}

          {qid === 7 && (
            <form action={submitPitch.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
              <label className="text-xs font-medium text-zinc-600">
                <TermTooltip term="pitch">{t('q7Pitch')}</TermTooltip>
                <input
                  name="pitchMinutes"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={project.pitch_minutes ?? ''}
                  className={FIELD_CLASS}
                />
              </label>
              <WizardSaveButton />
            </form>
          )}

          {qid === 8 &&
            (allProcesses.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('noProcesses')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {allProcesses.map((p) => (
                  <form
                    key={p.id}
                    action={submitKaizenNote.bind(null, projectId, scenario.id, p.id)}
                    className="flex flex-col gap-2 rounded-surface border border-zinc-100 p-3"
                  >
                    <label className="text-xs font-medium text-zinc-600">
                      <TermTooltip term="kaizenBlitz">{p.name}</TermTooltip>
                      <textarea
                        name="kaizenNote"
                        rows={2}
                        defaultValue={p.kaizen_note ?? ''}
                        placeholder={t('q8NotePlaceholder')}
                        className={FIELD_CLASS}
                      />
                    </label>
                    <WizardSaveButton className="self-start" />
                  </form>
                ))}
              </div>
            ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {qid > 1 ? (
            <Link
              href={`/editor/${projectId}/future-state/${qid - 1}${scenarioQuery}`}
              className="text-sm text-zinc-600 hover:underline"
            >
              {t('previousQuestion', { id: qid - 1 })}
            </Link>
          ) : (
            <span />
          )}
          {qid < 8 ? (
            <Link
              href={`/editor/${projectId}/future-state/${qid + 1}${scenarioQuery}`}
              className="text-sm text-zinc-600 hover:underline"
            >
              {t('nextQuestion', { id: qid + 1 })}
            </Link>
          ) : (
            <Link
              href={`/editor/${projectId}/future-state${scenarioQuery}`}
              className="text-sm font-medium text-zinc-950 hover:underline"
            >
              {t('toOverview')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
