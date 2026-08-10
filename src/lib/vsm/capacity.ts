// Pure capacity check: is a process's *effective* cycle time (accounting
// for OEE losses and parallel operators) still under the customer-driven
// takt time? This is the classic Black-Belt question the raw C/T-vs-Takt
// comparison misses — a process can look fine on cycle time alone and
// still be a real bottleneck once availability/performance/quality losses
// are factored in, and conversely a second operator can resolve one.

import { effectiveCycleTime as applyOperatorCount, type KpiProcessInput } from './calculations'

export interface CapacityCheckInput extends KpiProcessInput {
  /** OEE as a percent, e.g. 78 for 78%. */
  oee: number
}

export interface CapacityCheckResult {
  /** (cycleTime / operatorCount) / (oee / 100) — Infinity if oee is 0 (no real capacity at all). */
  effectiveCycleTime: number
  /** True only when a takt time is known and the effective cycle time exceeds it. */
  isBottleneck: boolean
}

export function checkCapacity(input: CapacityCheckInput, taktTimeMinutes: number | null): CapacityCheckResult {
  const oeeFraction = input.oee > 0 ? input.oee / 100 : 0
  const perOperatorCycleTime = applyOperatorCount(input)
  const effectiveCycleTime = oeeFraction > 0 ? perOperatorCycleTime / oeeFraction : Infinity
  const isBottleneck = taktTimeMinutes !== null && effectiveCycleTime > taktTimeMinutes

  return { effectiveCycleTime, isBottleneck }
}
