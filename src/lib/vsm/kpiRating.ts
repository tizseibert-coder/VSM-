// Turns two of the headline KPIs into a tier, so the number in the KPI bar
// carries the same "is this good?" answer the Branchenvergleich already gives.
//
// Deliberately only two. Bearbeitungszeit, Durchlaufzeit and Taktzeit have no
// absolute good or bad — a takt of 2.4 min is neither, it is whatever the
// customer asks for. Putting a chip next to them would be inventing a
// judgement, which is worse than leaving the question open.

import type { BenchmarkTier } from './benchmark'

/**
 * Process Cycle Efficiency = Bearbeitungszeit / Durchlaufzeit.
 *
 * The bands are the orientation values common in Lean literature for discrete
 * manufacturing: below ~5 % is the unimproved norm, 25 %+ is the continuous-flow
 * end of the scale. They are a rule of thumb, not a standard — which is why the
 * tooltip on the tile says so. Null in, null out: no lead time, no judgement.
 */
export function ratePce(percent: number | null): BenchmarkTier | null {
  if (percent === null) return null
  if (percent >= 25) return 'top'
  if (percent >= 10) return 'good'
  if (percent >= 5) return 'average'
  return 'below'
}

/**
 * Ist-Ausbringung / Kundenbedarf. Unlike PCE this one has a hard, non-arbitrary
 * threshold: at 1.0 the line exactly meets demand. Below it the backlog grows,
 * which is a fact about the line, not a matter of ambition. The band above 1.0
 * only distinguishes "just enough" from "has headroom".
 */
export function rateCapacityCoverage(ratio: number | null): BenchmarkTier | null {
  if (ratio === null) return null
  if (ratio >= 1.2) return 'top'
  if (ratio >= 1) return 'good'
  if (ratio >= 0.9) return 'average'
  return 'below'
}
