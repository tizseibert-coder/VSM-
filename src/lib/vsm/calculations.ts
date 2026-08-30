// Live VSM KPI calculations. Cycle times are entered in minutes; lead time is
// derived in days from buffer WIP against the rate at which units actually
// leave the value stream (Little's Law: PLT = WIP / departure rate).
//
// Two rates are deliberately kept apart, because conflating them was a real
// defect here (Black-Belt audit, finding 0):
//
//   demand rate  — what the customer pulls (Jahresbedarf / Arbeitstage).
//                  Drives *takt time*, which is a target, not a measurement.
//   exit rate    — what the line actually ships, set by its slowest station
//                  (the time trap). Drives *lead time*.
//
// Before, the demand rate was used for both and labelled "Exitrate". That made
// lead time mathematically independent of every cycle time: halving the
// bottleneck moved the PLT by exactly nothing, which is the one thing a VSM
// exists to show.

/** Working days assumed per year when deriving daily demand from annual throughput. */
export const WORKING_DAYS_PER_YEAR = 250

/** Minutes of available production time per shift, used for takt time. */
export const SHIFT_MINUTES = 480

export interface KpiProcessInput {
  cycleTime: number
  /**
   * Parallel operators at this station. Convention: each operator
   * independently finishes a full unit, so N operators produce N units in
   * one cycleTime — the station's *effective* (output) cycle time is
   * cycleTime / operatorCount. Defaults to 1 (no change) when omitted.
   */
  operatorCount?: number
  /**
   * OEE in percent (e.g. 78). Omitted means "not captured" and applies no
   * derating at all — a process without a measured OEE should not silently
   * lose capacity. An explicit 0 does mean no capacity.
   */
  oee?: number
}

export interface KpiBufferInput {
  wipCount: number
}

export interface KpiInput {
  processes: KpiProcessInput[]
  buffers: KpiBufferInput[]
  annualThroughput: number | null
  /**
   * Available production minutes per day. Feeds both takt time
   * (availableMinutesPerDay / demand rate) and the exit rate
   * (availableMinutesPerDay / bottleneck cycle time).
   */
  availableMinutesPerDay?: number
}

export interface KpiResult {
  totalCycleTimeMinutes: number
  /** Null when neither a line nor a demand is known — "unknown", not "zero". */
  totalLeadTimeDays: number | null
  valueAddedRatioPercent: number | null
  taktTimeMinutes: number | null
  /** Units/day the customer pulls. Null until an annual throughput is set. */
  demandRatePerDay: number | null
  /** Units/day the line can actually ship. Null until it has at least one process. */
  exitRatePerDay: number | null
  /** Capacity cycle time of the slowest station — the time trap. */
  bottleneckCycleTimeMinutes: number | null
  /** exitRate / demandRate. Below 1 means the line cannot meet demand. */
  capacityCoverage: number | null
  /**
   * The rate actually used for lead time: the smaller of exit and demand rate.
   * Exposed so the UI can name the divisor it is showing instead of implying
   * one — the formula caption under Durchlaufzeit reads it directly.
   */
  departureRatePerDay: number | null
}

/** Units/day a project needs to produce, derived from annual throughput. Null if unset/invalid. */
export function calculateDailyDemand(annualThroughput: number | null): number | null {
  if (!annualThroughput || annualThroughput <= 0) return null
  return annualThroughput / WORKING_DAYS_PER_YEAR
}

/** cycleTime adjusted for parallel operators — see KpiProcessInput.operatorCount. Exported so capacity.ts can share the same convention. */
export function effectiveCycleTime(process: KpiProcessInput): number {
  const operatorCount = process.operatorCount && process.operatorCount > 0 ? process.operatorCount : 1
  return process.cycleTime / operatorCount
}

/**
 * How long the station really occupies per unit once availability, performance
 * and quality losses are paid for — the number that decides which station is
 * the time trap. Assumes cycleTime is the *ideal* cycle time; entering an
 * already-observed time here would count the losses twice.
 */
export function capacityCycleTime(process: KpiProcessInput): number {
  const perOperator = effectiveCycleTime(process)
  if (process.oee === undefined) return perOperator
  if (process.oee <= 0) return Infinity
  return perOperator / (process.oee / 100)
}

export function calculateKpis(input: KpiInput): KpiResult {
  // The value-adding time a single unit receives. Deliberately the raw cycle
  // time: a second operator doubles the labour content and halves the output
  // cycle time, but the unit is still worked on just as long. Dividing here
  // (the old behaviour) understated both Bearbeitungszeit and the VA ratio.
  const totalCycleTimeMinutes = input.processes.reduce((sum, p) => sum + p.cycleTime, 0)
  const availableMinutesPerDay = input.availableMinutesPerDay ?? SHIFT_MINUTES

  const demandRatePerDay = calculateDailyDemand(input.annualThroughput)
  const taktTimeMinutes = demandRatePerDay ? availableMinutesPerDay / demandRatePerDay : null

  // The slowest station gates the whole stream, whatever its position — the
  // last process is only the bottleneck by coincidence.
  const bottleneckCycleTimeMinutes =
    input.processes.length > 0 ? Math.max(...input.processes.map(capacityCycleTime)) : null

  const exitRatePerDay =
    bottleneckCycleTimeMinutes === null
      ? null
      : Number.isFinite(bottleneckCycleTimeMinutes)
        ? availableMinutesPerDay / bottleneckCycleTimeMinutes
        : 0

  const capacityCoverage =
    exitRatePerDay !== null && demandRatePerDay !== null && demandRatePerDay > 0
      ? exitRatePerDay / demandRatePerDay
      : null

  // Little's Law wants the rate units *actually* depart at. A line ships at
  // its own capacity when that is the binding constraint; when it has capacity
  // to spare it still only ships what the customer pulls, because surplus
  // capacity does not drain inventory any faster.
  const knownRates = [exitRatePerDay, demandRatePerDay].filter((rate): rate is number => rate !== null)
  const departureRatePerDay = knownRates.length > 0 ? Math.min(...knownRates) : null

  const totalWipCount = input.buffers.reduce((sum, b) => sum + b.wipCount, 0)
  const totalLeadTimeDays =
    departureRatePerDay !== null && departureRatePerDay > 0 ? totalWipCount / departureRatePerDay : null

  // Lead-time days come from a rate measured per *working* day, so converting
  // them to minutes has to use the working day as well. Multiplying by a
  // 1440-minute calendar day (the old behaviour) mixed a calendar denominator
  // with a processing-minute numerator and understated the ratio by
  // 1440 / availableMinutesPerDay — a factor of 3 on a single shift, and a
  // different factor for every shift model.
  const totalLeadTimeMinutes = totalLeadTimeDays !== null ? totalLeadTimeDays * availableMinutesPerDay : null
  const valueAddedRatioPercent =
    totalLeadTimeMinutes !== null && totalLeadTimeMinutes > 0
      ? (totalCycleTimeMinutes / totalLeadTimeMinutes) * 100
      : null

  return {
    totalCycleTimeMinutes,
    totalLeadTimeDays,
    valueAddedRatioPercent,
    taktTimeMinutes,
    demandRatePerDay,
    exitRatePerDay,
    bottleneckCycleTimeMinutes,
    capacityCoverage,
    departureRatePerDay,
  }
}
