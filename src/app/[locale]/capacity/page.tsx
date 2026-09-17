import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { DEFAULT_WORKDAYS_PER_MONTH, type CamaHoursMonth, type CamaLineResult } from '@/lib/vsm/capacityAnalysis'
import { CAMA_BADGE_CLASS, CAMA_EMOJI } from '@/components/VSMEditor/camaColors'
import { computeCamaHoursTrend, computeCamaLine, computeCamaStretchLine } from '@/components/VSMEditor/camaLine'
import { TermTooltip } from '@/components/VSMEditor/TermTooltip'
import { formatDecimal } from '@/lib/vsm/numberFormat'
import { buttonPrimary, buttonSecondary, inputMd } from '@/components/ui/buttons'
import { SubmitButton } from '@/components/ui/SubmitButton'
import DeleteLineButton from '@/components/capacity/DeleteLineButton'
import HoursTrendChart from '@/components/capacity/HoursTrendChart'
import type { Tables } from '@/types/database'
import {
  addCapacityAction,
  createLine,
  deleteCapacityAction,
  saveLineCapacity,
  toggleCapacityActionStatus,
} from './actions'

// Das Kapazitätsmanagement ist organisationsweit, keine öffentliche Seite.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type ProductionLine = Tables<'production_lines'>
type LineCapacity = Tables<'line_capacity'>
type CapacityAction = Tables<'capacity_actions'>

interface LineRow {
  line: ProductionLine
  capacity: LineCapacity | null
  result: CamaLineResult | null
  linkedProcessCount: number
}

const RECOMMENDATION_KEY = {
  blue: 'recommendationBlue',
  green: 'recommendationGreen',
  orange: 'recommendationOrange',
  red: 'recommendationRed',
} as const

const FIELD_LABEL = 'text-xs font-medium text-zinc-700'

export default async function CapacityLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; error?: string; saved?: string }>
}) {
  const { line: lineParam, error, saved } = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('Capacity')
  const tMonths = await getTranslations('Settings')
  const tEditor = await getTranslations('Editor')
  const tNav = await getTranslations('Nav')

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            {tNav('backToDashboard')}
          </Link>
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{orgResult.error}</p>
        </div>
      </div>
    )
  }

  const { active } = orgResult
  const canWrite = active.role === 'owner' || active.role === 'editor'

  const supabase = await createClient()

  const { data: linesRaw } = await supabase
    .from('production_lines')
    .select('*')
    .eq('organization_id', active.organizationId)
    .order('name', { ascending: true })
  const lines = linesRaw ?? []
  const lineIds = lines.map((l) => l.id)

  // Zwei Abfragen statt eines PostgREST-Embeds, wie loadMemberships() in
  // activeOrg.ts es schon begründet: der Rückgabetyp eines Embeds (Objekt vs.
  // Array) ist je nach Version nicht verlässlich genug für die zwei Zeilen,
  // die man sich damit spart.
  const { data: capacities } =
    lineIds.length > 0
      ? await supabase.from('line_capacity').select('*').in('line_id', lineIds)
      : { data: [] as LineCapacity[] }
  const capacityByLineId = new Map((capacities ?? []).map((c) => [c.line_id, c]))

  const { data: linkedProcesses } =
    lineIds.length > 0
      ? await supabase.from('processes').select('id, line_id').in('line_id', lineIds)
      : { data: [] as { id: string; line_id: string | null }[] }
  const linkedCountByLineId = new Map<string, number>()
  for (const p of linkedProcesses ?? []) {
    if (!p.line_id) continue
    linkedCountByLineId.set(p.line_id, (linkedCountByLineId.get(p.line_id) ?? 0) + 1)
  }

  const profile = await loadOrgProfile(active.organizationId, active.organizationName)
  const workdaysByMonth = profile.capacityWorkdays.map((value) => value ?? DEFAULT_WORKDAYS_PER_MONTH)

  const rows: LineRow[] = lines.map((line) => {
    const capacity = capacityByLineId.get(line.id) ?? null
    return {
      line,
      capacity,
      result: computeCamaLine(capacity, workdaysByMonth),
      linkedProcessCount: linkedCountByLineId.get(line.id) ?? 0,
    }
  })
  const configured = rows
    .filter((r): r is LineRow & { result: CamaLineResult } => r.result !== null)
    .sort((a, b) => b.result.peakMonth.loadRate - a.result.peakMonth.loadRate)
  const unconfigured = rows.filter((r) => r.result === null)

  const selectedRow = lineParam ? rows.find((r) => r.line.id === lineParam) : undefined

  const { data: actionsForSelected } = selectedRow
    ? await supabase
        .from('capacity_actions')
        .select('*')
        .eq('line_id', selectedRow.line.id)
        .order('created_at', { ascending: true })
    : { data: [] as CapacityAction[] }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
          {tNav('backToDashboard')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t('linesTitle')}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t('linesIntro', { org: active.organizationName })}</p>

        {/* Kurzer In-App-Einstieg plus Link auf die ausfuehrliche oeffentliche
            Anleitung (Nutzerentscheidung 2026-09-17, "Beides") — <details>
            statt eines eigenen Zustands/Client-Skripts, aufklappbar und
            standardmaessig zu, damit er niemandem im Weg steht, der die
            Seite schon kennt. */}
        <details className="mt-4 rounded-surface border border-zinc-200 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-950">{t('guideInlineTitle')}</summary>
          <p className="mt-2 leading-relaxed text-zinc-600">{t('guideInlineBody')}</p>
          <Link href="/capacity-guide" className="mt-2 inline-block font-medium text-brand-600 hover:underline">
            {t('guideInlineLink')}
          </Link>
        </details>

        {error && <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && !error && (
          <p className="mt-4 rounded-control bg-brand-50 px-3 py-2 text-sm text-brand-700">{t('saved')}</p>
        )}

        {selectedRow ? (
          <LineDetail
            row={selectedRow}
            stretchResult={computeCamaStretchLine(selectedRow.capacity, workdaysByMonth)}
            hoursTrend={computeCamaHoursTrend(selectedRow.capacity, workdaysByMonth)}
            actions={actionsForSelected ?? []}
            canWrite={canWrite}
            locale={locale}
            t={t}
            tMonths={tMonths}
            tEditor={tEditor}
          />
        ) : (
          <>
            {canWrite && (
              <form action={createLine} className="mt-6 flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <label htmlFor="new-line-name" className={FIELD_LABEL}>
                    {t('lineNameLabel')}
                  </label>
                  <input
                    id="new-line-name"
                    name="name"
                    placeholder={t('newLineNamePlaceholder')}
                    maxLength={120}
                    required
                    className={`mt-1 w-full ${inputMd}`}
                  />
                </div>
                <SubmitButton className={buttonPrimary}>{t('newLineCreate')}</SubmitButton>
              </form>
            )}

            {lines.length === 0 ? (
              <p className="mt-6 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                {t('linesEmpty')}
              </p>
            ) : (
              <>
                <p className="mt-6 text-xs text-zinc-500">{t('legend')}</p>

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
                          <th className="p-3 text-left font-medium text-zinc-500">
                            <TermTooltip term="loadRate">{t('tableLoadRate')}</TermTooltip>
                          </th>
                          <th className="p-3 text-left font-medium text-zinc-500">
                            <TermTooltip term="cama">{t('tableAmpel')}</TermTooltip>
                          </th>
                          <th className="p-3 text-left font-medium text-zinc-500">{t('tableRecommendation')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configured.map(({ line, result }) => (
                          <tr key={line.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                            <td className="p-3 font-medium text-zinc-950">
                              <Link href={`/capacity?line=${line.id}`} className="hover:underline">
                                {line.name}
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
                      {unconfigured.map(({ line }) => (
                        <li key={line.id} className="flex items-center justify-between gap-2 text-sm">
                          <Link href={`/capacity?line=${line.id}`} className="text-zinc-700 hover:underline">
                            {line.name}
                          </Link>
                          <span className="text-xs text-zinc-500">{t('unconfiguredHint')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
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
  row,
  stretchResult,
  hoursTrend,
  actions,
  canWrite,
  locale,
  t,
  tMonths,
  tEditor,
}: {
  row: LineRow
  stretchResult: CamaLineResult | null
  hoursTrend: CamaHoursMonth[] | null
  actions: CapacityAction[]
  canWrite: boolean
  locale: string
  t: Awaited<ReturnType<typeof getTranslations<'Capacity'>>>
  tMonths: Awaited<ReturnType<typeof getTranslations<'Settings'>>>
  tEditor: Awaited<ReturnType<typeof getTranslations<'Editor'>>>
}) {
  const { line, capacity, result, linkedProcessCount } = row

  return (
    <div className="mt-4">
      <Link href="/capacity" className="text-xs text-zinc-500 hover:underline">
        {t('backToLines')}
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-950">{t('detailTitle', { name: line.name })}</h2>
        {canWrite && (
          <DeleteLineButton lineId={line.id} lineName={line.name} linkedProcessCount={linkedProcessCount} />
        )}
      </div>
      {linkedProcessCount > 0 && (
        <p className="mt-1 text-xs text-zinc-500">{t('linkedProcessCount', { count: linkedProcessCount })}</p>
      )}

      {/* Ein Formular, zwei Absende-Knöpfe (formAction überschreibt die
          Standardaktion je Knopf) — siehe saveLineCapacity-Kommentar in
          actions.ts für den Unterschied zwischen "Speichern" und
          "Stress = Basis × 1,2". */}
      <form action={saveLineCapacity.bind(null, line.id, false)} className="mt-6 rounded-surface border border-zinc-200 p-4">
        <fieldset disabled={!canWrite} className="space-y-6 disabled:opacity-70">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>{t('lineNameLabel')}</span>
              <input name="name" defaultValue={line.name} maxLength={120} className={inputMd} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>
                <TermTooltip term="processCycleTime">{t('cycleTimeLabel')}</TermTooltip>
              </span>
              <input
                name="cycle_time_minutes"
                inputMode="decimal"
                defaultValue={capacity?.cycle_time_minutes ?? ''}
                className={inputMd}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>
                <TermTooltip term="operatorCount">{t('operatorCountLabel')}</TermTooltip>
              </span>
              <input
                name="operator_count"
                inputMode="numeric"
                defaultValue={capacity?.operator_count ?? 1}
                className={inputMd}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>
                <TermTooltip term="oee">{t('oeeLabel')}</TermTooltip>
              </span>
              <input name="oee" inputMode="decimal" defaultValue={capacity?.oee ?? 78} className={inputMd} />
            </label>
          </div>
          <p className="-mt-3 text-xs text-amber-700">{tEditor('operatorCountIdentityHint')}</p>

          <div>
            <span className={FIELD_LABEL}>{t('shiftModelLabel')}</span>
            <div className="mt-1 flex flex-wrap gap-4">
              {([1, 2, 3] as const).map((shift) => (
                <label key={shift} className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="shift_model"
                    value={shift}
                    defaultChecked={capacity?.shift_model === shift}
                  />
                  {t(`shift${shift}Label`)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL}>{t('demandSectionTitle')}</span>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <label key={month} className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">{tMonths(`month${month}`)}</span>
                  <input
                    name={`demand_${month}`}
                    inputMode="numeric"
                    defaultValue={
                      Array.isArray(capacity?.monthly_demand) ? ((capacity?.monthly_demand as number[])[month - 1] ?? '') : ''
                    }
                    className={inputMd}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL}>{t('actualHoursSectionTitle')}</span>
            <p className="mt-1 text-xs text-zinc-500">{t('actualHoursHint')}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <label key={month} className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">{tMonths(`month${month}`)}</span>
                  <input
                    name={`actual_hours_${month}`}
                    inputMode="decimal"
                    defaultValue={
                      Array.isArray(capacity?.monthly_actual_hours)
                        ? ((capacity?.monthly_actual_hours as (number | null)[])[month - 1] ?? '')
                        : ''
                    }
                    className={inputMd}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL}>{t('stretchSectionTitle')}</span>
            <p className="mt-1 text-xs text-zinc-500">{t('stretchHint')}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <label key={month} className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">{tMonths(`month${month}`)}</span>
                  <input
                    name={`stretch_${month}`}
                    inputMode="numeric"
                    defaultValue={
                      Array.isArray(capacity?.monthly_demand_stretch)
                        ? ((capacity?.monthly_demand_stretch as number[])[month - 1] ?? '')
                        : ''
                    }
                    className={inputMd}
                  />
                </label>
              ))}
            </div>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-4">
              <SubmitButton className={buttonPrimary}>{t('save')}</SubmitButton>
              <SubmitButton
                formAction={saveLineCapacity.bind(null, line.id, true)}
                className={buttonSecondary}
              >
                {t('stretchPrefillButton')}
              </SubmitButton>
            </div>
          )}
        </fieldset>
      </form>

      {result ? (
        <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="p-2 text-left font-medium text-zinc-500">{t('monthColumn')}</th>
                <th className="p-2 text-left font-medium text-zinc-500">{t('demandColumn')}</th>
                <th className="p-2 text-left font-medium text-zinc-500">{t('capacityColumn')}</th>
                <th className="p-2 text-left font-medium text-zinc-500">
                  <TermTooltip term="loadRate">{t('loadRateColumn')}</TermTooltip>
                </th>
                <th className="p-2 text-left font-medium text-zinc-500">
                  <TermTooltip term="cama">{t('ampelColumn')}</TermTooltip>
                </th>
                {stretchResult && (
                  <th className="p-2 text-left font-medium text-zinc-500">{t('stretchAmpelColumn')}</th>
                )}
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
                  {stretchResult && (
                    <td className="p-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-xs font-medium ${CAMA_BADGE_CLASS[stretchResult.months[month.month - 1].color]}`}
                      >
                        {CAMA_EMOJI[stretchResult.months[month.month - 1].color]}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          {t('notConfiguredDetail')}
        </p>
      )}

      {/* Forecast vs. Ist (Nutzergespraech 2026-09-17): eigener Block statt
          einer weiteren Tabellenspalte oben — andere Einheit (Stunden statt
          Stueck/Ampel), siehe capacityAnalysis.ts, calcCamaHoursTrend. Nur
          unter derselben Bedingung wie die Ampel-Tabelle (Taktrate und
          Schichtmodell erfasst), deshalb kein eigener Leerzustand noetig. */}
      {hoursTrend && (
        <div className="mt-6 rounded-surface border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">{t('hoursTrendTitle')}</h3>
          <p className="mt-1 text-xs text-zinc-500">{t('hoursTrendHint')}</p>
          <div className="mt-4">
            <HoursTrendChart
              months={hoursTrend}
              monthLabels={Array.from({ length: 12 }, (_, i) => tMonths(`month${i + 1}`).slice(0, 3))}
              locale={locale}
              legendAvailable={t('hoursLegendAvailable')}
              legendRequired={t('hoursLegendRequired')}
              legendActual={t('hoursLegendActual')}
              ariaLabel={t('hoursTrendAriaLabel', { name: line.name })}
            />
          </div>
        </div>
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
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <form
                      action={toggleCapacityActionStatus.bind(
                        null,
                        line.id,
                        action.id,
                        action.status === 'done' ? 'open' : 'done'
                      )}
                    >
                      <SubmitButton className={buttonSecondary}>
                        {action.status === 'done' ? t('reopen') : t('markDone')}
                      </SubmitButton>
                    </form>
                    <form action={deleteCapacityAction.bind(null, line.id, action.id)}>
                      <SubmitButton className={buttonSecondary}>{t('delete')}</SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <form
            action={addCapacityAction.bind(null, line.id)}
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
        )}
      </div>
    </div>
  )
}
