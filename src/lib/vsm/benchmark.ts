// Classifies a project's actual metric value against an industry benchmark
// reference (P25/median/P75), matching the convention used throughout this
// project: 'top' is always the best tier, regardless of whether a lower or
// higher raw number is better for that particular metric.

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

  if (value <= ref.p75) return 'top'
  if (value <= ref.median) return 'good'
  if (value <= ref.p25) return 'average'
  return 'below'
}
