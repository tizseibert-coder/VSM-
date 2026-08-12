import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deriveFutureStateQuestions, type FutureStateInput } from '@/lib/vsm/futureStateQuestions'
import { TermTooltip } from '@/components/VSMEditor/TermTooltip'
import { submitTaktTime, submitBuffer, submitPacemaker, submitHeijunka, submitPitch, submitKaizenNote } from '../wizard-actions'

const STATUS_LABEL: Record<string, string> = {
  answered: 'Beantwortet',
  open: 'Offen',
  not_applicable: 'Noch nicht relevant',
}

const STATUS_CLASS: Record<string, string> = {
  answered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  open: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  not_applicable: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500',
}

const FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'
const SUBMIT_CLASS =
  'rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200'

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
  const boundaryLabel = (id: string | null, boundaryLabel: string) => (id ? (nameById.get(id) ?? '?') : boundaryLabel)

  const input: FutureStateInput = {
    processes: allProcesses.map((p) => ({
      id: p.id,
      name: p.name,
      cycleTime: p.cycle_time,
      operatorCount: p.operator_count,
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
    <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/editor/${projectId}/future-state${scenarioQuery}`}
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-500"
        >
          ← Alle 8 Fragen
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Frage {qid} von 8</p>
            <h1 className="mt-0.5 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{current.question}</h1>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[current.status]}`}>
            {STATUS_LABEL[current.status]}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{current.summary}</p>

        {saved === '1' && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            ✓ Gespeichert.
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {qid === 1 && (
            <form action={submitTaktTime.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <TermTooltip term="exitRate">Jahresbedarf (Stück/Jahr)</TermTooltip>
                <input
                  name="annualThroughput"
                  type="number"
                  min={0}
                  defaultValue={project.annual_throughput ?? ''}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <TermTooltip term="availableMinutesPerDay">Verfügbare Produktionszeit (min/Tag)</TermTooltip>
                <input
                  name="availableMinutesPerDay"
                  type="number"
                  min={0}
                  defaultValue={project.available_minutes_per_day}
                  className={FIELD_CLASS}
                />
              </label>
              <button type="submit" className={SUBMIT_CLASS}>
                Speichern
              </button>
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
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Übergabe an den Kunden{terminal?.from_process_id ? ` (nach ${boundaryLabel(terminal.from_process_id, '?')})` : ''}.
                  </p>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Art des Fertigwarenbestands
                    <select name="bufferType" defaultValue={terminal?.buffer_type ?? 'standard'} className={FIELD_CLASS}>
                      <option value="standard">Direktversand (kein Bestand)</option>
                      <option value="supermarket">Fertigwarenlager als Supermarkt</option>
                      <option value="safety_stock">Sicherheitsbestand</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <TermTooltip term="wip">Bestand (Stück)</TermTooltip>
                    <input
                      name="wipCount"
                      type="number"
                      min={0}
                      defaultValue={terminal?.wip_count ?? 0}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <button type="submit" className={SUBMIT_CLASS}>
                    Speichern
                  </button>
                </form>
              )
            })()}

          {qid === 3 &&
            (() => {
              const internal = allBuffers.filter((b) => b.from_process_id !== null && b.to_process_id !== null)
              if (internal.length === 0) {
                return (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Noch keine internen Verbindungen zwischen Prozessen vorhanden.
                  </p>
                )
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Nur die Ja/Nein-Entscheidung „läuft diese Verbindung ohne Zwischenpuffer direkt weiter?&rdquo; —
                    für Supermarkt/FIFO/Push bei den verbleibenden Verbindungen siehe Frage 4.
                  </p>
                  {internal.map((b) => (
                    <form
                      key={b.id}
                      action={submitBuffer.bind(null, projectId, scenario.id, 3, b.from_process_id, b.to_process_id)}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-900"
                    >
                      <input type="hidden" name="wipCount" value={b.wip_count} />
                      <p className="mr-auto text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {boundaryLabel(b.from_process_id, 'Lieferant')} → {boundaryLabel(b.to_process_id, 'Kunde')}
                      </p>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          name="bufferType"
                          value="continuous"
                          defaultChecked={b.buffer_type === 'continuous'}
                        />
                        <TermTooltip term="onePieceFlow">Continuous Flow</TermTooltip>
                      </label>
                      <button type="submit" className={SUBMIT_CLASS}>
                        Speichern
                      </button>
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Noch keine internen Verbindungen zwischen Prozessen vorhanden.
                  </p>
                )
              }
              if (relevant.length === 0) {
                return (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Alle internen Verbindungen laufen bereits als Continuous Flow (Frage 3) — nichts mehr zu steuern.
                  </p>
                )
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Push oder Pull für die Verbindungen, die nicht bereits Continuous Flow sind (Frage 3).
                  </p>
                  {relevant.map((b) => (
                    <form
                      key={b.id}
                      action={submitBuffer.bind(null, projectId, scenario.id, 4, b.from_process_id, b.to_process_id)}
                      className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-900"
                    >
                      <p className="mr-auto w-full text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {boundaryLabel(b.from_process_id, 'Lieferant')} → {boundaryLabel(b.to_process_id, 'Kunde')}
                      </p>
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">
                        <TermTooltip term="bufferType">Typ</TermTooltip>
                        <select name="bufferType" defaultValue={b.buffer_type ?? 'standard'} className={FIELD_CLASS}>
                          <option value="standard">Standard (Push)</option>
                          <option value="supermarket">Supermarkt (Pull)</option>
                          <option value="fifo">FIFO-Bahn (Pull)</option>
                        </select>
                      </label>
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">
                        <TermTooltip term="wip">WIP</TermTooltip>
                        <input name="wipCount" type="number" min={0} defaultValue={b.wip_count} className={FIELD_CLASS} />
                      </label>
                      <button type="submit" className={SUBMIT_CLASS}>
                        Speichern
                      </button>
                    </form>
                  ))}
                </div>
              )
            })()}

          {qid === 5 &&
            (allProcesses.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Noch keine Prozesse angelegt.</p>
            ) : (
              <form action={submitPacemaker.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <TermTooltip term="pacemaker">Schrittmacher-Prozess</TermTooltip>
                  <select name="processId" defaultValue={pacemaker?.id ?? ''} className={FIELD_CLASS}>
                    <option value="" disabled>
                      — Prozess wählen —
                    </option>
                    {allProcesses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={SUBMIT_CLASS}>
                  Als Schrittmacher setzen
                </button>
              </form>
            ))}

          {qid === 6 &&
            (!pacemaker ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Erst Frage 5 (Schrittmacher) beantworten — Heijunka hängt methodisch am Schrittmacher.
              </p>
            ) : (
              <form
                action={submitHeijunka.bind(null, projectId, scenario.id, pacemaker.id)}
                className="flex flex-col gap-3"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Schrittmacher: {pacemaker.name}</p>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" name="hasHeijunka" defaultChecked={pacemaker.has_heijunka} />
                  <TermTooltip term="heijunka">Heijunka-Box aktiv</TermTooltip>
                </label>
                <button type="submit" className={SUBMIT_CLASS}>
                  Speichern
                </button>
              </form>
            ))}

          {qid === 7 && (
            <form action={submitPitch.bind(null, projectId, scenario.id)} className="flex flex-col gap-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <TermTooltip term="pitch">Pitch (min)</TermTooltip>
                <input
                  name="pitchMinutes"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={project.pitch_minutes ?? ''}
                  className={FIELD_CLASS}
                />
              </label>
              <button type="submit" className={SUBMIT_CLASS}>
                Speichern
              </button>
            </form>
          )}

          {qid === 8 &&
            (allProcesses.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Noch keine Prozesse angelegt.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {allProcesses.map((p) => (
                  <form
                    key={p.id}
                    action={submitKaizenNote.bind(null, projectId, scenario.id, p.id)}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-900"
                  >
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <TermTooltip term="kaizenBlitz">{p.name}</TermTooltip>
                      <textarea
                        name="kaizenNote"
                        rows={2}
                        defaultValue={p.kaizen_note ?? ''}
                        placeholder="z. B. Rüstzeit halbieren"
                        className={FIELD_CLASS}
                      />
                    </label>
                    <button type="submit" className={`${SUBMIT_CLASS} self-start`}>
                      Speichern
                    </button>
                  </form>
                ))}
              </div>
            ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {qid > 1 ? (
            <Link
              href={`/editor/${projectId}/future-state/${qid - 1}${scenarioQuery}`}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              ← Frage {qid - 1}
            </Link>
          ) : (
            <span />
          )}
          {qid < 8 ? (
            <Link
              href={`/editor/${projectId}/future-state/${qid + 1}${scenarioQuery}`}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Frage {qid + 1} →
            </Link>
          ) : (
            <Link
              href={`/editor/${projectId}/future-state${scenarioQuery}`}
              className="text-sm font-medium text-zinc-950 hover:underline dark:text-zinc-50"
            >
              Zur Übersicht →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
