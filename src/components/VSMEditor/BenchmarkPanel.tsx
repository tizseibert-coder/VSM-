'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Tables } from '@/types/database'
import { classifyBenchmark } from '@/lib/vsm/benchmark'
import { TierChip } from './TierChip'
import { inputSm } from '@/components/ui/buttons'

type Process = Tables<'processes'>
type BenchmarkReference = Tables<'benchmark_reference'>

interface Props {
  processes: Process[]
  references: BenchmarkReference[]
}



export default function BenchmarkPanel({ processes, references }: Props) {
  const t = useTranslations('Benchmark')
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
    // Kein eigener Seitenrahmen mehr (mx-auto max-w-6xl px-6): Das Panel
    // stand frueher als eigener Block unter dem Editor und bringt seine
    // Breite seit dem Reiter von der Spalte mit, in der es liegt.
    <section className="rounded-surface border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-950">{t('title')}</h2>
        <span className="rounded-control bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          {t('sampleDataWarning')}
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
          className={inputSm}
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
          className={inputSm}
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
          label={t('avgCycleTime')}
          value={avgCycleTime}
          unit={t('unitMin')}
          reference={cycleRef}
          higherIsBetter={false}
        />
        <BenchmarkRow label={t('avgOee')} value={avgOee} unit="%" reference={oeeRef} higherIsBetter />
      </div>
    </section>
  )
}

function BenchmarkRow({
  label,
  value,
  unit,
  reference,
  higherIsBetter,
}: {
  label: string
  value: number | null
  unit: string
  reference: BenchmarkReference | undefined
  higherIsBetter: boolean
}) {
  const t = useTranslations('Benchmark')
  if (value === null || !reference || reference.p25 === null || reference.median === null || reference.p75 === null) {
    return (
      <div className="rounded-surface border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">
        {label}: keine Daten für diese Auswahl.
      </div>
    )
  }

  const tier = classifyBenchmark(
    value,
    { p25: reference.p25, median: reference.median, p75: reference.p75 },
    higherIsBetter
  )

  return (
    <div className="rounded-surface border border-zinc-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <TierChip tier={tier} />
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-950">
        {value.toFixed(1)} {unit}
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        P25 {reference.p25} · Median {reference.median} · P75 {reference.p75} {unit}
        <span className="ml-1 text-zinc-600">
          ({higherIsBetter ? t('higherIsBetter') : t('lowerIsBetter')})
        </span>
      </div>
    </div>
  )
}
