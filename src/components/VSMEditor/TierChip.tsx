// The little coloured verdict next to a number. Extracted from BenchmarkPanel
// when the KPI bar needed the same thing: two copies of the label and colour
// maps would have drifted apart, and "Gut" meaning one colour here and another
// there is exactly the sort of detail that quietly erodes trust in the numbers.

'use client'

import { useTranslations } from 'next-intl'
import type { BenchmarkTier } from '@/lib/vsm/benchmark'

// Nur die Zuordnung Stufe -> Uebersetzungsschluessel bleibt hier; der Text
// selbst steht im Namensraum `Tier`. Die Farben bleiben ebenfalls im Code,
// weil sie Darstellung sind und keine Uebersetzung.
const TIER_KEY: Record<BenchmarkTier, string> = {
  top: 'top',
  good: 'good',
  average: 'average',
  below: 'needsImprovement',
}

const TIER_CLASS: Record<BenchmarkTier, string> = {
  top: 'bg-green-50 text-green-700',
  good: 'bg-lime-50 text-lime-700',
  average: 'bg-amber-50 text-amber-700',
  below: 'bg-red-50 text-red-700',
}

export function TierChip({ tier }: { tier: BenchmarkTier }) {
  const t = useTranslations('Tier')
  return (
    <span className={`rounded-control px-2 py-0.5 text-xs font-medium ${TIER_CLASS[tier]}`}>
      {t(TIER_KEY[tier])}
    </span>
  )
}
