// Classifies a project's actual metric value against an industry benchmark
// reference (P25/median/P75), matching the convention used throughout this
// project: 'top' is always the best tier, regardless of whether a lower or
// higher raw number is better for that particular metric.
//
// The reference is stored as *real* percentiles, so p25 <= median <= p75
// always holds. The direction lives here, not in the data: for a
// lower-is-better metric the good end of the distribution is p25. Encoding
// the direction by swapping the stored values instead (which this project did
// for cycle time) makes the UI print an impossible distribution and silently
// inverts every rating the day real percentiles are imported.

export interface BenchmarkRef {
  p25: number
  median: number
  p75: number
}

export type BenchmarkTier = 'top' | 'good' | 'average' | 'below'

export function classifyBenchmark(value: number, ref: BenchmarkRef, higherIsBetter: boolean): BenchmarkTier {
  if (higherIsBetter) {
    if (value >= ref.p75) return 'top'
    if (value >= ref.median) return 'good'
    if (value >= ref.p25) return 'average'
    return 'below'
  }

  if (value <= ref.p25) return 'top'
  if (value <= ref.median) return 'good'
  if (value <= ref.p75) return 'average'
  return 'below'
}
