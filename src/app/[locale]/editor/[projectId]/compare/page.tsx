import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildComparisonRows, type ComparisonState } from '@/lib/vsm/scenarioComparison'
import { buildComparisonMetrics } from '@/lib/vsm/comparisonTable'
import { formatCurrency } from '@/lib/vsm/capital'
import { formatDecimal } from '@/lib/vsm/numberFormat'

// Zuordnung Risikostufe -> Uebersetzungsschluessel im Namensraum `Scenario`.
const RISK_KEY: Record<string, string> = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }

export default async function ComparePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const locale = await getLocale()
  const t = await getTranslations('Compare')
  const tEd = await getTranslations('Editor')
  const tSc = await getTranslations('Scenario')
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
  if (!project) notFound()

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // Fetch every process/buffer for the project in one query each, then group
  // by scenario_id client-side — cheaper than one query per state.
  const { data: allProcesses } = await supabase.from('processes').select('*').eq('project_id', projectId)
  const { data: allBuffers } = await supabase.from('inventory_buffers').select('*').eq('project_id', projectId)

  const states: ComparisonState[] = [
    {
      id: null,
      label: tSc('currentState'),
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === null)
        .map((p) => ({ cycleTime: p.cycle_time, operatorCount: p.operator_count, oee: p.oee, wip: p.wip ?? undefined })),
      buffers: (allBuffers ?? [])
        .filter((b) => b.scenario_id === null)
        .map((b) => ({ wipCount: b.wip_count })),
    },
    ...(scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      label: `${scenario.type ?? '?'} · ${scenario.name ?? ''}`,
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === scenario.id)
        .map((p) => ({ cycleTime: p.cycle_time, operatorCount: p.operator_count, oee: p.oee, wip: p.wip ?? undefined })),
      buffers: (allBuffers ?? [])
        .filter((b) => b.scenario_id === scenario.id)
        .map((b) => ({ wipCount: b.wip_count })),
    })),
  ]

  const rows = buildComparisonRows(
    states,
    project.annual_throughput,
    project.available_minutes_per_day ?? undefined
  )

  // Der Bestand in Geld, je Zustand mit derselben Bewertung gerechnet — und
  // die Differenz zum Ist-Zustand, denn genau die ist die Aussage: Was ein
  // Szenario an Kapital freisetzt, das heute im Regal liegt.
  //
  // [Bedienbarkeitspruefung 2026-09-03, B16] Die Zeilen entstehen jetzt in
  // lib/vsm/comparisonTable.ts, damit diese Seite und das PDF dieselbe
  // Rechnung benutzen und nicht auseinanderlaufen koennen.
  const money = (value: number) => formatCurrency(value, project.currency, locale)
  const metricRows = buildComparisonMetrics(
    rows,
    {
      processes: t('processes'),
      cycleTimeSum: tEd('kpiCycleTimeSum'),
      leadTime: tEd('kpiLeadTime'),
      pce: tEd('kpiPce'),
      taktTime: tEd('kpiTaktTime'),
      tiedUpCapital: t('tiedUpCapital'),
      releasedCapital: t('releasedCapital'),
      unitMin: tEd('unitMin'),
      unitDays: tEd('unitDays'),
      unitPercent: tEd('unitPercent'),
    },
    { num: (value, digits = 1) => formatDecimal(value, locale, digits), money },
    project.piece_value
  )

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/editor/${projectId}`} className="text-xs text-zinc-500 hover:underline">
          {t('backToEditor')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
          {t('title', { project: project.name })}
        </h1>

        {states.length <= 1 && (
          <p className="mt-4 rounded-control bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
            {t('empty')}
          </p>
        )}

        <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="p-3 text-left font-medium text-zinc-500">{t('metric')}</th>
                {rows.map((r) => (
                  <th key={r.id ?? 'ist'} className="p-3 text-left font-medium text-zinc-950">
                    <Link
                      href={r.id ? `/editor/${projectId}?scenario=${r.id}` : `/editor/${projectId}`}
                      className="hover:underline"
                    >
                      {r.label}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((metricRow) => (
                <tr key={metricRow.label} className="border-b border-zinc-100 last:border-0">
                  <td className="p-3 text-zinc-500">{metricRow.label}</td>
                  {rows.map((r, i) => (
                    <td key={r.id ?? 'ist'} className="p-3 text-zinc-950">
                      {metricRow.values[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {project.piece_value === null && (
          <p className="mt-2 text-xs text-zinc-500">{t('capitalHint')}</p>
        )}

        {(scenarios ?? []).length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="p-3 text-left font-medium text-zinc-500">{t('businessCase')}</th>
                  {(scenarios ?? []).map((s) => (
                    <th key={s.id} className="p-3 text-left font-medium text-zinc-950">
                      {s.type} · {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100">
                  <td className="p-3 text-zinc-500">{t('investment')}</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950">
                      {/* Die Spalte heisst investment_chf, weil sie so angelegt
                          wurde; angezeigt wird sie in der Waehrung des Projekts
                          (Migration 20260903212855). */}
                      {s.investment_chf != null ? money(s.investment_chf) : '–'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-100">
                  <td className="p-3 text-zinc-500">{t('payback')}</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950">
                      {s.payback_months != null ? t('months', { count: s.payback_months }) : '–'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-zinc-500">{t('risk')}</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950">
                      {s.risk_level ? (RISK_KEY[s.risk_level] ? tSc(RISK_KEY[s.risk_level]) : s.risk_level) : '–'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
