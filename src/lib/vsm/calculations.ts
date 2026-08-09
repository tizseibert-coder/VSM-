// Live VSM KPI calculations. Cycle times are entered in minutes;
// lead time is derived in days from buffer WIP against daily customer
// demand (classic VSM "days of supply" logic).

/** Working days assumed per year when deriving daily demand from annual throughput. */
export const WORKING_DAYS_PER_YEAR = 250

/** Minutes of available production time per shift, used for takt time. */
export const SHIFT_MINUTES = 480

export interface KpiProcessInput {
  cycleTime: number
}

export interface KpiBufferInput {
  wipCount: number
}

export interface KpiInput {
  processes: KpiProcessInput[]
  buffers: KpiBufferInput[]
  annualThroughput: number | null
}

export interface KpiResult {
  totalCycleTimeMinutes: number
  totalLeadTimeDays: number
  valueAddedRatioPercent: number | null
  taktTimeMinutes: number | null
  dailyDemand: number | null
}

/** Units/day a project needs to produce, derived from annual throughput. Null if unset/invalid. */
export function calculateDailyDemand(annualThroughput: number | null): number | null {
  if (!annualThroughput || annualThroughput <= 0) return null
  return annualThroughput / WORKING_DAYS_PER_YEAR
}

export function calculateKpis(input: KpiInput): KpiResult {
  const totalCycleTimeMinutes = input.processes.reduce((sum, p) => sum + p.cycleTime, 0)
  const dailyDemand = calculateDailyDemand(input.annualThroughput)

  const totalLeadTimeDays = dailyDemand
    ? input.buffers.reduce((sum, b) => sum + b.wipCount / dailyDemand, 0)
    : 0

  const totalLeadTimeMinutes = totalLeadTimeDays * 24 * 60
  const valueAddedRatioPercent =
    totalLeadTimeMinutes > 0 ? (totalCycleTimeMinutes / totalLeadTimeMinutes) * 100 : null

  const taktTimeMinutes = dailyDemand ? SHIFT_MINUTES / dailyDemand : null

  return {
    totalCycleTimeMinutes,
    totalLeadTimeDays,
    valueAddedRatioPercent,
    taktTimeMinutes,
    dailyDemand,
  }
}
