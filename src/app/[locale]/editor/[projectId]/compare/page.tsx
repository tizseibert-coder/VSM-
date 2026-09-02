import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildComparisonRows, type ComparisonState } from '@/lib/vsm/scenarioComparison'

// Zuordnung Risikostufe -> Uebersetzungsschluessel im Namensraum `Scenario`.
const RISK_KEY: Record<string, string> = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }

export default async function ComparePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
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

  const rows = buildComparisonRows(states, project.annual_throughput)

  const metricRows: { label: string; format: (r: (typeof rows)[number]) => string }[] = [
    { label: t('processes'), format: (r) => String(r.processCount) },
    {
      label: tEd('kpiCycleTimeSum'),
      format: (r) => `${r.totalCycleTimeMinutes.toFixed(1)} ${tEd('unitMin')}`,
    },
    {
      label: tEd('kpiLeadTime'),
      format: (r) =>
        r.totalLeadTimeDays !== null && r.totalLeadTimeDays > 0
          ? `${r.totalLeadTimeDays.toFixed(1)} ${tEd('unitDays')}`
          : '–',
    },
    {
      label: tEd('kpiPce'),
      format: (r) =>
        r.valueAddedRatioPercent !== null
          ? `${r.valueAddedRatioPercent.toFixed(2)} ${tEd('unitPercent')}`
          : '–',
    },
    {
      label: tEd('kpiTaktTime'),
      format: (r) =>
        r.taktTimeMinutes !== null ? `${r.taktTimeMinutes.toFixed(1)} ${tEd('unitMin')}` : '–',
    },
  ]

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
                  {rows.map((r) => (
                    <td key={r.id ?? 'ist'} className="p-3 text-zinc-950">
                      {metricRow.format(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                      {s.investment_chf != null ? `CHF ${s.investment_chf.toLocaleString('de-CH')}` : '–'}
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
