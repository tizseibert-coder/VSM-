import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { DEFAULT_WORKDAYS_PER_MONTH, type CamaLineResult } from '@/lib/vsm/capacityAnalysis'
import { CAMA_BADGE_CLASS, CAMA_EMOJI } from '@/components/VSMEditor/camaColors'
import { computeCamaLine } from '@/components/VSMEditor/camaLine'
import { TermTooltip } from '@/components/VSMEditor/TermTooltip'
import { formatDecimal } from '@/lib/vsm/numberFormat'
import type { Tables } from '@/types/database'

// Seit der Linien-Umstellung (docs/plan-cama-line-module.md) ist diese Seite
// eine reine *Ansicht* auf die Linien, die im aktiven Zustand dieses
// Projekts über processes.line_id verknüpft sind — bearbeitet wird
// Kapazität nirgends mehr hier, sondern organisationsweit auf /capacity
// (Schritt 3). Das vermeidet zwei Formulare für dieselben Daten und macht
// sichtbar, dass eine Linie mehreren Projekten/Szenarien gemeinsam gehören
// kann, nicht nur diesem einen.

type Process = Tables<'processes'>
type ProductionLine = Tables<'production_lines'>

interface LineRow {
  process: Process
  line: ProductionLine
  result: CamaLineResult | null
}

const RECOMMENDATION_KEY = {
  blue: 'recommendationBlue',
  green: 'recommendationGreen',
  orange: 'recommendationOrange',
  red: 'recommendationRed',
} as const

export default async function ProjectCapacityView({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ scenario?: string }>
}) {
  const { projectId } = await params
  const { scenario: scenarioParam } = await searchParams
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

  const activeScenario = scenarioParam ? (scenarios ?? []).find((s) => s.id === scenarioParam) : undefined
  const scenarioId = activeScenario?.id ?? null

  const { data: allProcesses } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  const processes = (allProcesses ?? []).filter((p) => p.scenario_id === scenarioId)

  const linkedProcesses = processes.filter((p) => p.line_id !== null)
  const unlinkedProcesses = processes.filter((p) => p.line_id === null)
  const lineIds = Array.from(new Set(linkedProcesses.map((p) => p.line_id as string)))

  // Zwei Abfragen statt eines Embeds — wie an jeder anderen Stelle in diesem
  // Schema (loadMemberships() in activeOrg.ts begründet das ausführlich).
  const { data: lines } =
    lineIds.length > 0 ? await supabase.from('production_lines').select('*').in('id', lineIds) : { data: [] }
  const lineById = new Map((lines ?? []).map((l) => [l.id, l]))

  const { data: capacities } =
    lineIds.length > 0 ? await supabase.from('line_capacity').select('*').in('line_id', lineIds) : { data: [] }
  const capacityByLineId = new Map((capacities ?? []).map((c) => [c.line_id, c]))

  const profile = await loadOrgProfile(project.organization_id, '')
  const workdaysByMonth = profile.capacityWorkdays.map((value) => value ?? DEFAULT_WORKDAYS_PER_MONTH)

  const rows: LineRow[] = linkedProcesses
    .map((process) => {
      const line = lineById.get(process.line_id as string)
      if (!line) return null
      return {
        process,
        line,
        result: computeCamaLine(capacityByLineId.get(line.id) ?? null, workdaysByMonth),
      }
    })
    .filter((r): r is LineRow => r !== null)
  const configured = rows
    .filter((r): r is LineRow & { result: CamaLineResult } => r.result !== null)
    .sort((a, b) => b.result.peakMonth.loadRate - a.result.peakMonth.loadRate)
  const unconfigured = rows.filter((r) => r.result === null)

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
        <p className="mt-1 text-sm text-zinc-600">
          {t('projectViewIntro')}{' '}
          <Link href="/capacity" className="text-brand-600 hover:underline">
            {t('projectViewIntroLink')}
          </Link>
        </p>

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

        {processes.length === 0 ? (
          <p className="mt-6 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            {t('empty')}
          </p>
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
                    {configured.map(({ process, line, result }) => (
                      <tr key={process.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                        <td className="p-3 font-medium text-zinc-950">
                          <Link href={`/capacity?line=${line.id}`} className="hover:underline">
                            {line.name}
                          </Link>
                          <span className="ml-1 text-xs font-normal text-zinc-400">({process.name})</span>
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
                  {unconfigured.map(({ process, line }) => (
                    <li key={process.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/capacity?line=${line.id}`} className="text-zinc-700 hover:underline">
                        {line.name} <span className="text-xs text-zinc-400">({process.name})</span>
                      </Link>
                      <span className="text-xs text-zinc-500">{t('unconfiguredHint')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unlinkedProcesses.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-700">{t('unlinkedSectionTitle')}</h2>
                <ul className="mt-2 space-y-1">
                  {unlinkedProcesses.map((process) => (
                    <li key={process.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={scenarioId ? `/editor/${projectId}?scenario=${scenarioId}` : `/editor/${projectId}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {process.name}
                      </Link>
                      <span className="text-xs text-zinc-500">{t('unlinkedHint')}</span>
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
