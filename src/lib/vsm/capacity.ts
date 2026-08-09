// Pure capacity check: is a process's *effective* cycle time (accounting
// for OEE losses) still under the customer-driven takt time? This is the
// classic Black-Belt question the raw C/T-vs-Takt comparison misses — a
// process can look fine on cycle time alone and still be a real bottleneck
// once availability/performance/quality losses are factored in.

export interface CapacityCheckInput {
  cycleTime: number
  /** OEE as a percent, e.g. 78 for 78%. */
  oee: number
}

export interface CapacityCheckResult {
  /** cycleTime / (oee / 100) — Infinity if oee is 0 (no real capacity at all). */
  effectiveCycleTime: number
  /** True only when a takt time is known and the effective cycle time exceeds it. */
  isBottleneck: boolean
}

export function checkCapacity(input: CapacityCheckInput, taktTimeMinutes: number | null): CapacityCheckResult {
  const oeeFraction = input.oee > 0 ? input.oee / 100 : 0
  const effectiveCycleTime = oeeFraction > 0 ? input.cycleTime / oeeFraction : Infinity
  const isBottleneck = taktTimeMinutes !== null && effectiveCycleTime > taktTimeMinutes

  return { effectiveCycleTime, isBottleneck }
}
