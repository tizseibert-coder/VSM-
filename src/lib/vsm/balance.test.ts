import { describe, expect, it } from 'vitest'
import { buildBalanceChart } from './balance'

// The example line from the dashboard seed, which the audit worked through by
// hand: takt 2.4 min, and three of four stations over it.
const exampleLine = [
  { id: 's', name: 'Sägen', cycleTime: 1.2, oee: 82 },
  { id: 'd', name: 'Drehen', cycleTime: 3.4, oee: 78 },
  { id: 'f', name: 'Fräsen', cycleTime: 2.6, oee: 85 },
  { id: 'm', name: 'Montage', cycleTime: 4.1, oee: 90 },
]

describe('buildBalanceChart', () => {
  it('returns an empty chart for a line without processes', () => {
    const chart = buildBalanceChart([], 2.4)

    expect(chart.bars).toEqual([])
    expect(chart.totalWorkContentMinutes).toBe(0)
    expect(chart.minimumStations).toBe(0)
  })

  it('splits each bar into productive work and OEE loss', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)
    const drehen = chart.bars[1]

    expect(drehen.name).toBe('Drehen')
    expect(drehen.workMinutes).toBeCloseTo(3.4, 5)
    // 3.4 / 0.78 = 4.359 -> 0.959 min of that is loss
    expect(drehen.lossMinutes).toBeCloseTo(0.959, 3)
    expect(drehen.totalMinutes).toBeCloseTo(4.359, 3)
  })

  it('keeps the process order of the value stream', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)

    expect(chart.bars.map((b) => b.name)).toEqual(['Sägen', 'Drehen', 'Fräsen', 'Montage'])
  })

  it('measures every bar against takt, not against the other bars', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)

    expect(chart.bars.map((b) => b.isOverTakt)).toEqual([false, true, true, true])
    // Fräsen looks harmless at 2.6 min raw but busts takt at 3.06 once its
    // OEE loss is paid for — the reason a Yamazumi uses occupancy, not C/T.
    expect(chart.bars[2].totalMinutes).toBeCloseTo(3.059, 3)
    expect(chart.bars[2].taktRatio).toBeCloseTo(1.275, 3)
  })

  it('marks exactly one bar as the bottleneck — the tallest', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)

    expect(chart.bars.map((b) => b.isBottleneck)).toEqual([false, false, false, true])
  })

  it('derives the fewest takt-conforming stations from the total work content', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)

    // 1.463 + 4.359 + 3.059 + 4.556 = 13.437 min of occupancy
    expect(chart.totalWorkContentMinutes).toBeCloseTo(13.437, 2)
    // 13.437 / 2.4 = 5.6 -> six stations, not the four that exist today
    expect(chart.minimumStations).toBe(6)
  })

  it('scales to the takt line when every bar sits below it', () => {
    // A comfortable line: the takt line must stay visible, otherwise the chart
    // would silently crop the very reference it is drawn against.
    const chart = buildBalanceChart([{ id: 'a', name: 'A', cycleTime: 1 }], 5)

    expect(chart.scaleMaxMinutes).toBe(5)
  })

  it('scales to the tallest bar when a bar exceeds takt', () => {
    const chart = buildBalanceChart(exampleLine, 2.4)

    expect(chart.scaleMaxMinutes).toBeCloseTo(4.556, 3)
  })

  it('applies no OEE loss to a process that carries no OEE value', () => {
    const chart = buildBalanceChart([{ id: 'a', name: 'A', cycleTime: 3 }], 2.4)

    expect(chart.bars[0].workMinutes).toBe(3)
    expect(chart.bars[0].lossMinutes).toBe(0)
    expect(chart.bars[0].totalMinutes).toBe(3)
  })

  it('halves the bar of a station running two operators in parallel', () => {
    const chart = buildBalanceChart([{ id: 'a', name: 'A', cycleTime: 10, operatorCount: 2 }], 6)

    expect(chart.bars[0].workMinutes).toBe(5)
    expect(chart.bars[0].isOverTakt).toBe(false)
  })

  it('leaves the takt comparison open when no takt is known', () => {
    const chart = buildBalanceChart(exampleLine, null)

    expect(chart.bars.every((b) => b.taktRatio === null)).toBe(true)
    expect(chart.bars.every((b) => b.isOverTakt === false)).toBe(true)
    expect(chart.minimumStations).toBeNull()
    // The bottleneck does not depend on takt — it is still identifiable.
    expect(chart.bars[3].isBottleneck).toBe(true)
  })

  it('survives a station with zero OEE without breaking the scale', () => {
    // Infinite occupancy would otherwise make every other bar zero-height.
    const chart = buildBalanceChart(
      [
        { id: 'a', name: 'A', cycleTime: 2 },
        { id: 'b', name: 'B', cycleTime: 3, oee: 0 },
      ],
      2.4
    )

    expect(chart.bars[1].totalMinutes).toBe(Infinity)
    expect(chart.bars[1].isBottleneck).toBe(true)
    expect(chart.bars[1].isOverTakt).toBe(true)
    expect(chart.scaleMaxMinutes).toBe(2.4) // from the finite bar and the takt line
    expect(chart.totalWorkContentMinutes).toBe(Infinity)
    expect(chart.minimumStations).toBeNull()
  })
})
