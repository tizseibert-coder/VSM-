// The little coloured verdict next to a number. Extracted from BenchmarkPanel
// when the KPI bar needed the same thing: two copies of the label and colour
// maps would have drifted apart, and "Gut" meaning one colour here and another
// there is exactly the sort of detail that quietly erodes trust in the numbers.

import type { BenchmarkTier } from '@/lib/vsm/benchmark'

const TIER_LABEL: Record<BenchmarkTier, string> = {
  top: 'Spitzenwert',
  good: 'Gut',
  average: 'Durchschnitt',
  below: 'Verbesserungsbedarf',
}

const TIER_CLASS: Record<BenchmarkTier, string> = {
  top: 'bg-green-50 text-green-700',
  good: 'bg-lime-50 text-lime-700',
  average: 'bg-amber-50 text-amber-700',
  below: 'bg-red-50 text-red-700',
}

export function TierChip({ tier }: { tier: BenchmarkTier }) {
  return (
    <span className={`rounded-control px-2 py-0.5 text-xs font-medium ${TIER_CLASS[tier]}`}>
      {TIER_LABEL[tier]}
    </span>
  )
}
