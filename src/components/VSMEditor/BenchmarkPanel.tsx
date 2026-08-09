'use client'

import { useMemo, useState } from 'react'
import type { Tables } from '@/types/database'
import { classifyBenchmark, type BenchmarkTier } from '@/lib/vsm/benchmark'

type Process = Tables<'processes'>
type BenchmarkReference = Tables<'benchmark_reference'>

interface Props {
  processes: Process[]
  references: BenchmarkReference[]
}

const TIER_LABEL: Record<BenchmarkTier, string> = {
  top: 'Spitzenwert',
  good: 'Gut',
  average: 'Durchschnitt',
  below: 'Verbesserungsbedarf',
}

const TIER_CLASS: Record<BenchmarkTier, string> = {
  top: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  good: 'bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-300',
  average: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  below: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

export default function BenchmarkPanel({ processes, references }: Props) {
  const industries = useMemo(() => [...new Set(references.map((r) => r.industry))], [references])
  const [industry, setIndustry] = useState(industries[0] ?? '')

  const sizes = useMemo(
    () => [...new Set(references.filter((r) => r.industry === industry).map((r) => r.company_size))],
    [references, industry]
  )
  const [companySize, setCompanySize] = useState(sizes[0] ?? '')

  const avgCycleTime =
    processes.length > 0 ? processes.reduce((s, p) => s + p.cycle_time, 0) / processes.length : null
  const avgOee = processes.length > 0 ? processes.reduce((s, p) => s + p.oee, 0) / processes.length : null

  const cycleRef = references.find(
    (r) => r.industry === industry && r.company_size === companySize && r.metric_name === 'cycle_time_min'
  )
  const oeeRef = references.find(
    (r) => r.industry === industry && r.company_size === companySize && r.metric_name === 'oee_percent'
  )

  if (references.length === 0) return null

  return (
    <div className="mx-auto mt-6 max-w-6xl px-6">
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Branchenvergleich</h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Beispieldaten — keine echten Branchenwerte
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value)
              const nextSizes = [...new Set(references.filter((r) => r.industry === e.target.value).map((r) => r.company_size))]
              setCompanySize(nextSizes[0] ?? '')
            }}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {industries.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BenchmarkRow
            label="Ø Zykluszeit"
            value={avgCycleTime}
            unit="min"
            ref={cycleRef}
            higherIsBetter={false}
          />
          <BenchmarkRow label="Ø OEE" value={avgOee} unit="%" ref={oeeRef} higherIsBetter />
        </div>
      </div>
    </div>
  )
}

function BenchmarkRow({
  label,
  value,
  unit,
  ref,
  higherIsBetter,
}: {
  label: string
  value: number | null
  unit: string
  ref: BenchmarkReference | undefined
  higherIsBetter: boolean
}) {
  if (value === null || !ref || ref.p25 === null || ref.median === null || ref.p75 === null) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-500">
        {label}: keine Daten für diese Auswahl.
      </div>
    )
  }

  const tier = classifyBenchmark(value, { p25: ref.p25, median: ref.median, p75: ref.p75 }, higherIsBetter)

  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-500">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_CLASS[tier]}`}>{TIER_LABEL[tier]}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value.toFixed(1)} {unit}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
        P25 {ref.p25} · Median {ref.median} · P75 {ref.p75} {unit}
      </div>
    </div>
  )
}
