import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildComparisonRows, type ComparisonState } from '@/lib/vsm/scenarioComparison'

const RISK_LABEL: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }

export default async function ComparePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
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
      label: 'Ist-Zustand',
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === null)
        .map((p) => ({ cycleTime: p.cycle_time })),
      buffers: (allBuffers ?? [])
        .filter((b) => b.scenario_id === null)
        .map((b) => ({ wipCount: b.wip_count })),
    },
    ...(scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      label: `${scenario.type ?? '?'} · ${scenario.name ?? 'Szenario'}`,
      processes: (allProcesses ?? [])
        .filter((p) => p.scenario_id === scenario.id)
        .map((p) => ({ cycleTime: p.cycle_time })),
      buffers: (allBuffers ?? [])
        .filter((b) => b.scenario_id === scenario.id)
        .map((b) => ({ wipCount: b.wip_count })),
    })),
  ]

  const rows = buildComparisonRows(states, project.annual_throughput)

  const metricRows: { label: string; format: (r: (typeof rows)[number]) => string }[] = [
    { label: 'Prozesse', format: (r) => String(r.processCount) },
    { label: 'Bearbeitungszeit', format: (r) => `${r.totalCycleTimeMinutes.toFixed(1)} min` },
    { label: 'Durchlaufzeit', format: (r) => (r.totalLeadTimeDays > 0 ? `${r.totalLeadTimeDays.toFixed(1)} Tage` : '–') },
    {
      label: 'Wertschöpfungsanteil',
      format: (r) => (r.valueAddedRatioPercent !== null ? `${r.valueAddedRatioPercent.toFixed(2)} %` : '–'),
    },
    { label: 'Taktzeit', format: (r) => (r.taktTimeMinutes !== null ? `${r.taktTimeMinutes.toFixed(1)} min` : '–') },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-5xl">
        <Link href={`/editor/${projectId}`} className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
          ← Zurück zum Editor
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Szenario-Vergleich — {project.name}
        </h1>

        {states.length <= 1 && (
          <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Noch kein Future-State-Szenario angelegt. Öffne den Editor und lege über „+ Neues Szenario&rdquo; einen
            Soll-Zustand an, um ihn hier mit dem Ist-Zustand zu vergleichen.
          </p>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="p-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Kennzahl</th>
                {rows.map((r) => (
                  <th key={r.id ?? 'ist'} className="p-3 text-left font-medium text-zinc-950 dark:text-zinc-50">
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
                <tr key={metricRow.label} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">{metricRow.label}</td>
                  {rows.map((r) => (
                    <td key={r.id ?? 'ist'} className="p-3 text-zinc-950 dark:text-zinc-50">
                      {metricRow.format(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(scenarios ?? []).length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="p-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Business Case</th>
                  {(scenarios ?? []).map((s) => (
                    <th key={s.id} className="p-3 text-left font-medium text-zinc-950 dark:text-zinc-50">
                      {s.type} · {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">Investition</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950 dark:text-zinc-50">
                      {s.investment_chf != null ? `CHF ${s.investment_chf.toLocaleString('de-CH')}` : '–'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">Payback</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950 dark:text-zinc-50">
                      {s.payback_months != null ? `${s.payback_months} Monate` : '–'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">Risiko</td>
                  {(scenarios ?? []).map((s) => (
                    <td key={s.id} className="p-3 text-zinc-950 dark:text-zinc-50">
                      {s.risk_level ? (RISK_LABEL[s.risk_level] ?? s.risk_level) : '–'}
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
