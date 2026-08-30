// Austaktungsdiagramm (Yamazumi): the line-balancing view the VSM timeline
// cannot give.
//
// The timeline below the canvas is a *flow* view — its axis is the position in
// the value stream, and it answers "how much of the lead time is waiting?".
// This is a *comparison* view: one bar per station against a horizontal takt
// line, answering "which station busts the takt, and how much work would have
// to move where?".
//
// Two deliberate choices:
//
//   - Bars show OEE-adjusted *occupancy*, not the raw cycle time. A station can
//     look harmless on C/T and still bust takt once its losses are paid for
//     (Fräsen in the example: 2.6 min raw, 3.06 min occupied, takt 2.4).
//   - Each bar is split into the productive part and the OEE loss, so the two
//     available countermeasures stay distinguishable: move work elements away,
//     or fix the losses at the station.

import { capacityCycleTime, effectiveCycleTime, type KpiProcessInput } from './calculations'

export interface BalanceProcessInput extends KpiProcessInput {
  id: string
  name: string
}

export interface BalanceBar {
  id: string
  name: string
  /** Output cycle time after parallel operators — the productive part. */
  workMinutes: number
  /** What the OEE losses add on top. Zero when no OEE was captured. */
  lossMinutes: number
  /** workMinutes + lossMinutes: the height that has to fit under takt. */
  totalMinutes: number
  /** totalMinutes / takt. Null while no takt is known. */
  taktRatio: number | null
  isOverTakt: boolean
  /** The tallest bar — the time trap that sets the exit rate. */
  isBottleneck: boolean
}

export interface BalanceChart {
  bars: BalanceBar[]
  taktTimeMinutes: number | null
  /** Upper end of the y-axis: the tallest finite bar or the takt line. */
  scaleMaxMinutes: number
  /** Sum of all occupancy — the work content to be redistributed. */
  totalWorkContentMinutes: number
  /**
   * ceil(work content / takt): the fewest stations that could each stay under
   * takt. Comparing it with the actual station count is the whole point of the
   * chart. Null when takt is unknown or a station has no capacity at all.
   */
  minimumStations: number | null
}

export function buildBalanceChart(
  processes: BalanceProcessInput[],
  taktTimeMinutes: number | null
): BalanceChart {
  const measured = processes.map((process) => {
    const workMinutes = effectiveCycleTime(process)
    const totalMinutes = capacityCycleTime(process)
    return {
      id: process.id,
      name: process.name,
      workMinutes,
      // Infinity - finite is Infinity, which is what a zero-OEE station means.
      lossMinutes: totalMinutes - workMinutes,
      totalMinutes,
    }
  })

  // Ties go to the first station: an arbitrary but stable pick beats marking
  // two "the" bottleneck.
  const peakMinutes = measured.reduce((peak, bar) => Math.max(peak, bar.totalMinutes), -Infinity)
  const bottleneckIndex = measured.findIndex((bar) => bar.totalMinutes === peakMinutes)

  const bars: BalanceBar[] = measured.map((bar, index) => ({
    ...bar,
    taktRatio: taktTimeMinutes !== null && taktTimeMinutes > 0 ? bar.totalMinutes / taktTimeMinutes : null,
    isOverTakt: taktTimeMinutes !== null && taktTimeMinutes > 0 && bar.totalMinutes > taktTimeMinutes,
    isBottleneck: index === bottleneckIndex,
  }))

  // A single zero-OEE station would otherwise flatten every other bar to a
  // hairline, so the scale is built from the finite bars and the takt line.
  const finiteHeights = measured.map((bar) => bar.totalMinutes).filter((minutes) => Number.isFinite(minutes))
  const scaleCandidates = [...finiteHeights, ...(taktTimeMinutes !== null ? [taktTimeMinutes] : [])]
  const scaleMaxMinutes = scaleCandidates.length > 0 ? Math.max(...scaleCandidates) : 1

  const totalWorkContentMinutes = measured.reduce((sum, bar) => sum + bar.totalMinutes, 0)
  const minimumStations =
    taktTimeMinutes !== null && taktTimeMinutes > 0 && Number.isFinite(totalWorkContentMinutes)
      ? Math.ceil(totalWorkContentMinutes / taktTimeMinutes)
      : null

  return { bars, taktTimeMinutes, scaleMaxMinutes, totalWorkContentMinutes, minimumStations }
}
