import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { DEFAULT_WORKDAYS_PER_MONTH, type CamaLineResult } from '@/lib/vsm/capacityAnalysis'
import { CAMA_BADGE_CLASS, CAMA_EMOJI } from '@/components/VSMEditor/camaColors'
import { computeCamaLine } from '@/components/VSMEditor/camaLine'
import { formatDecimal } from '@/lib/vsm/numberFormat'
import { buttonDangerSm, buttonPrimary, buttonSecondary, inputMd } from '@/components/ui/buttons'
import { SubmitButton } from '@/components/ui/SubmitButton'
import type { Tables } from '@/types/database'
import { addCapacityAction, deleteCapacityAction, toggleCapacityActionStatus } from './actions'

type Process = Tables<'processes'>
type CapacityAction = Tables<'capacity_actions'>

/** Ein Prozess ohne Schichtmodell hat keine CAMA-Ampel — nicht "rot", nicht
 *  "0", sondern schlicht noch nicht erfasst. Getrennt von den konfigurierten
 *  Linien gehalten, statt eine erfundene Ampel dafuer zu zeigen. */
interface LineRow {
  process: Process
  result: CamaLineResult | null
}

const RECOMMENDATION_KEY = {
  blue: 'recommendationBlue',
  green: 'recommendationGreen',
  orange: 'recommendationOrange',
  red: 'recommendationRed',
} as const

export default async function CapacityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ scenario?: string; process?: string; error?: string }>
}) {
  const { projectId } = await params
  const { scenario: scenarioParam, process: processParam, error } = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('Capacity')
  const tMonths = await getTranslations('Settings')
  const tScenario = await getTranslations('Scenario')

  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) notFound()

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // Derselbe Umgang mit einem verwaisten Szenario-Parameter wie im Editor:
  // still auf den Ist-Zustand zurueckfallen statt 404.
  const activeScenario = scenarioParam ? (scenarios ?? []).find((s) => s.id === scenarioParam) : undefined
  const scenarioId = activeScenario?.id ?? null

  const { data: allProcesses } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  const processes = (allProcesses ?? []).filter((p) => p.scenario_id === scenarioId)

  // CAMA: firmenweiter Kalender, aufgeloest auf 12 vollstaendige Werte —
  // dieselbe Vorbelegung wie im Editor (page.tsx), damit diese Seite und die
  // Live-Vorschau im Kapazitaetsdaten-Panel nie unterschiedlich rechnen.
  const profile = await loadOrgProfile(project.organization_id, '')
  const workdaysByMonth = profile.capacityWorkdays.map((value) => value ?? DEFAULT_WORKDAYS_PER_MONTH)

  const rows: LineRow[] = processes.map((process) => ({
    process,
    result: computeCamaLine(process, workdaysByMonth),
  }))
  const configured = rows
    .filter((r): r is LineRow & { result: CamaLineResult } => r.result !== null)
    .sort((a, b) => b.result.peakMonth.loadRate - a.result.peakMonth.loadRate)
  const unconfigured = rows.filter((r) => r.result === null)

  const selectedProcess = processParam ? processes.find((p) => p.id === processParam) : undefined
  const selectedResult = selectedProcess ? computeCamaLine(selectedProcess, workdaysByMonth) : null

  const { data: actionsForSelected } = selectedProcess
    ? await supabase
        .from('capacity_actions')
        .select('*')
        .eq('process_id', selectedProcess.id)
        .order('created_at', { ascending: true })
    : { data: [] as CapacityAction[] }

  const stateParam = scenarioId ? `scenario=${scenarioId}&` : ''

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href={scenarioId ? `/editor/${projectId}?scenario=${scenarioId}` : `/editor/${projectId}`}
          className="text-xs text-zinc-500 hover:underline"
        >
          {t('backToEditor')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t('title', { project: project.name })}</h1>

        {/* Zustand wechseln — dasselbe Muster wie die Spaltenkoepfe auf /compare. */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/editor/${projectId}/capacity`}
            className={scenarioId === null ? 'font-semibold text-brand-600' : 'text-zinc-600 hover:underline'}
          >
            {tScenario('currentState')}
          </Link>
          {(scenarios ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/editor/${projectId}/capacity?scenario=${s.id}`}
              className={s.id === scenarioId ? 'font-semibold text-brand-600' : 'text-zinc-600 hover:underline'}
            >
              {s.type} · {s.name}
            </Link>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {processes.length === 0 ? (
          <p className="mt-6 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            {t('empty')}
          </p>
        ) : selectedProcess ? (
          <LineDetail
            projectId={projectId}
            scenarioId={scenarioId}
            process={selectedProcess}
            result={selectedResult}
            actions={actionsForSelected ?? []}
            locale={locale}
            t={t}
            tMonths={tMonths}
          />
        ) : (
          <>
            <p className="mt-4 text-xs text-zinc-500">{t('legend')}</p>

            {configured.length === 0 ? (
              <p className="mt-4 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                {t('noneConfigured')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-surface border border-zinc-200">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="p-3 text-left font-medium text-zinc-500">{t('tableLine')}</th>
                      <th className="p-3 text-left font-medium text-zinc-500">{t('tablePeak')}</th>
                      <th className="p-3 text-left font-medium text-zinc-500">{t('tableLoadRate')}</th>
                      <th className="p-3 text-left font-medium text-zinc-500">{t('tableAmpel')}</th>
                      <th className="p-3 text-left font-medium text-zinc-500">{t('tableRecommendation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configured.map(({ process, result }) => (
                      <tr key={process.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                        <td className="p-3 font-medium text-zinc-950">
                          <Link
                            href={`/editor/${projectId}/capacity?${stateParam}process=${process.id}`}
                            className="hover:underline"
                          >
                            {process.name}
                          </Link>
                        </td>
                        <td className="p-3 text-zinc-700">{tMonths(`month${result.peakMonth.month}`)}</td>
                        <td className="p-3 text-zinc-700">
                          {Number.isFinite(result.peakMonth.loadRate)
                            ? formatDecimal(result.peakMonth.loadRate, locale, 2)
                            : '∞'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium ${CAMA_BADGE_CLASS[result.color]}`}
                          >
                            {CAMA_EMOJI[result.color]} {t(`color${capitalize(result.color)}`)}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-600">{t(RECOMMENDATION_KEY[result.color])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {unconfigured.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-700">{t('unconfiguredSectionTitle')}</h2>
                <ul className="mt-2 space-y-1">
                  {unconfigured.map(({ process }) => (
                    <li key={process.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/editor/${projectId}?${stateParam}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {process.name}
                      </Link>
                      <span className="text-xs text-zinc-500">{t('unconfiguredHint')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function LineDetail({
  projectId,
  scenarioId,
  process,
  result,
  actions,
  locale,
  t,
  tMonths,
}: {
  projectId: string
  scenarioId: string | null
  process: Process
  result: CamaLineResult | null
  actions: CapacityAction[]
  locale: string
  t: Awaited<ReturnType<typeof getTranslations<'Capacity'>>>
  tMonths: Awaited<ReturnType<typeof getTranslations<'Settings'>>>
}) {
  const stateParam = scenarioId ? `scenario=${scenarioId}&` : ''
  const backHref = `/editor/${projectId}/capacity${scenarioId ? `?scenario=${scenarioId}` : ''}`

  return (
    <div className="mt-4">
      <Link href={backHref} className="text-xs text-zinc-500 hover:underline">
        {t('backToTable')}
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-zinc-950">{t('detailTitle', { name: process.name })}</h2>

      {result ? (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            {t('detailPeakHint', {
              month: tMonths(`month${result.peakMonth.month}`),
              loadRate: Number.isFinite(result.peakMonth.loadRate)
                ? formatDecimal(result.peakMonth.loadRate, locale, 2)
                : '∞',
            })}
          </p>

          <div className="mt-4 overflow-x-auto rounded-surface border border-zinc-200">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="p-2 text-left font-medium text-zinc-500">{t('monthColumn')}</th>
                  <th className="p-2 text-left font-medium text-zinc-500">{t('demandColumn')}</th>
                  <th className="p-2 text-left font-medium text-zinc-500">{t('capacityColumn')}</th>
                  <th className="p-2 text-left font-medium text-zinc-500">{t('loadRateColumn')}</th>
                  <th className="p-2 text-left font-medium text-zinc-500">{t('ampelColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((month) => (
                  <tr key={month.month} className="border-b border-zinc-100 last:border-0">
                    <td className="p-2 text-zinc-950">{tMonths(`month${month.month}`)}</td>
                    <td className="p-2 text-zinc-700">{formatDecimal(month.demand, locale, 0)}</td>
                    <td className="p-2 text-zinc-700">{formatDecimal(month.capacity, locale, 0)}</td>
                    <td className="p-2 text-zinc-700">
                      {Number.isFinite(month.loadRate) ? formatDecimal(month.loadRate, locale, 2) : '∞'}
                    </td>
                    <td className="p-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-xs font-medium ${CAMA_BADGE_CLASS[month.color]}`}
                      >
                        {CAMA_EMOJI[month.color]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          {t('notConfiguredDetail')}{' '}
          <Link href={`/editor/${projectId}?${stateParam}`} className="text-brand-600 hover:underline">
            {t('toEditor')}
          </Link>
        </p>
      )}

      <div className="mt-6 rounded-surface border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold text-zinc-950">{t('actionPlanTitle')}</h3>

        {actions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">{t('noActions')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {actions.map((action) => (
              <li
                key={action.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-zinc-50 px-3 py-2 text-sm"
              >
                <div>
                  <p className={action.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-950'}>
                    {action.description}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {[
                      action.owner,
                      action.due_date,
                      action.target_month ? tMonths(`month${action.target_month}`) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form
                    action={toggleCapacityActionStatus.bind(
                      null,
                      projectId,
                      scenarioId,
                      process.id,
                      action.id,
                      action.status === 'done' ? 'open' : 'done'
                    )}
                  >
                    <SubmitButton className={buttonSecondary}>
                      {action.status === 'done' ? t('reopen') : t('markDone')}
                    </SubmitButton>
                  </form>
                  <form action={deleteCapacityAction.bind(null, projectId, scenarioId, process.id, action.id)}>
                    <SubmitButton className={buttonDangerSm}>{t('delete')}</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addCapacityAction.bind(null, projectId, scenarioId, process.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-4"
        >
          <div className="min-w-[220px] flex-1">
            <label htmlFor="ca-description" className="block text-xs font-medium text-zinc-600">
              {t('descriptionLabel')}
            </label>
            <input
              id="ca-description"
              name="description"
              defaultValue={result ? t(RECOMMENDATION_KEY[result.color]) : ''}
              maxLength={500}
              className={`mt-1 w-full ${inputMd}`}
            />
          </div>
          <div>
            <label htmlFor="ca-owner" className="block text-xs font-medium text-zinc-600">
              {t('ownerLabel')}
            </label>
            <input id="ca-owner" name="owner" maxLength={120} className={`mt-1 w-36 ${inputMd}`} />
          </div>
          <div>
            <label htmlFor="ca-due" className="block text-xs font-medium text-zinc-600">
              {t('dueDateLabel')}
            </label>
            <input id="ca-due" name="due_date" type="date" className={`mt-1 ${inputMd}`} />
          </div>
          <div>
            <label htmlFor="ca-month" className="block text-xs font-medium text-zinc-600">
              {t('targetMonthLabel')}
            </label>
            <select id="ca-month" name="target_month" defaultValue="" className={`mt-1 ${inputMd}`}>
              <option value="">{t('noTargetMonth')}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {tMonths(`month${month}`)}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className={buttonPrimary}>{t('addAction')}</SubmitButton>
        </form>
      </div>
    </div>
  )
}
