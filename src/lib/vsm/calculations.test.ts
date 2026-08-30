import { describe, expect, it } from 'vitest'
import {
  SHIFT_MINUTES,
  WORKING_DAYS_PER_YEAR,
  calculateDailyDemand,
  calculateKpis,
  capacityCycleTime,
} from './calculations'

describe('calculateDailyDemand', () => {
  it('returns null when annual throughput is not set', () => {
    expect(calculateDailyDemand(null)).toBeNull()
  })

  it('returns null when annual throughput is zero or negative', () => {
    expect(calculateDailyDemand(0)).toBeNull()
    expect(calculateDailyDemand(-10)).toBeNull()
  })

  it('divides annual throughput by the working-days constant', () => {
    expect(calculateDailyDemand(WORKING_DAYS_PER_YEAR * 100)).toBe(100)
  })
})

describe('capacityCycleTime', () => {
  it('is the plain cycle time when no OEE is given', () => {
    expect(capacityCycleTime({ cycleTime: 4 })).toBe(4)
  })

  it('stretches the cycle time by the OEE loss', () => {
    // 4 min at 80% OEE -> the station really needs 5 min per unit
    expect(capacityCycleTime({ cycleTime: 4, oee: 80 })).toBeCloseTo(5, 5)
  })

  it('accounts for parallel operators before the OEE derating', () => {
    // two operators halve the output cycle time, then 80% OEE stretches it
    expect(capacityCycleTime({ cycleTime: 4, operatorCount: 2, oee: 80 })).toBeCloseTo(2.5, 5)
  })

  it('is infinite at zero OEE — the station has no capacity at all', () => {
    expect(capacityCycleTime({ cycleTime: 4, oee: 0 })).toBe(Infinity)
  })
})

describe('calculateKpis', () => {
  it('returns zeroed-out KPIs for an empty VSM', () => {
    const result = calculateKpis({ processes: [], buffers: [], annualThroughput: null })

    expect(result.totalCycleTimeMinutes).toBe(0)
    // Neither a line nor a demand -> no rate at all, so lead time is *unknown*
    // rather than zero. "0.0 Tage" would read as perfect flow.
    expect(result.totalLeadTimeDays).toBeNull()
    expect(result.valueAddedRatioPercent).toBeNull()
    expect(result.taktTimeMinutes).toBeNull()
    expect(result.demandRatePerDay).toBeNull()
    expect(result.exitRatePerDay).toBeNull()
    expect(result.capacityCoverage).toBeNull()
  })

  it('sums cycle times across all processes', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 3.5 }, { cycleTime: 2 }, { cycleTime: 1.5 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(result.totalCycleTimeMinutes).toBe(7)
  })

  it('does NOT shorten the processing time when a station has two operators', () => {
    // A second operator doubles the labour content and halves the *output*
    // cycle time — but the unit itself is still worked on for 10 minutes.
    // Dividing here understated both Bearbeitungszeit and the VA ratio.
    const result = calculateKpis({
      processes: [{ cycleTime: 10, operatorCount: 2 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(result.totalCycleTimeMinutes).toBe(10)
    // The output side still sees the halved cycle time: 480 / 5 = 96 units/day.
    expect(result.exitRatePerDay).toBeCloseTo(96, 5)
  })

  it('treats a missing or zero operatorCount as a single operator (no change)', () => {
    const noField = calculateKpis({ processes: [{ cycleTime: 10 }], buffers: [], annualThroughput: null })
    const zero = calculateKpis({
      processes: [{ cycleTime: 10, operatorCount: 0 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(noField.totalCycleTimeMinutes).toBe(10)
    expect(zero.totalCycleTimeMinutes).toBe(10)
  })

  it('falls back to the demand rate for lead time when there is no line yet', () => {
    // daily demand = 50'000 / 250 = 200 units/day
    // buffer of 400 units -> 2 days of supply
    const result = calculateKpis({
      processes: [],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.demandRatePerDay).toBe(200)
    expect(result.exitRatePerDay).toBeNull()
    expect(result.totalLeadTimeDays).toBe(2)
  })

  it('sums lead time across multiple buffers', () => {
    const result = calculateKpis({
      processes: [],
      buffers: [{ wipCount: 400 }, { wipCount: 200 }],
      annualThroughput: 50_000,
    })

    expect(result.totalLeadTimeDays).toBe(3)
  })

  it('computes value-added ratio as processing time over lead time', () => {
    // A line balanced exactly to takt: 12 stations x 2.4 min = 28.8 min of
    // processing, and 480 / 2.4 = 200 units/day capacity — exactly the demand,
    // so the demand rate is the binding one and lead time is 400/200 = 2 days.
    const result = calculateKpis({
      processes: Array.from({ length: 12 }, () => ({ cycleTime: 2.4 })),
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.totalCycleTimeMinutes).toBeCloseTo(28.8, 5)
    expect(result.totalLeadTimeDays).toBeCloseTo(2, 5)
    // 2 working days = 2 x 480 min of production, not 2 x 1440 calendar
    // minutes: the days come from a working-day rate, so the conversion has to
    // use the working day too. 28.8 / 960 = 3%.
    expect(result.valueAddedRatioPercent).toBeCloseTo(3, 5)
  })

  it('converts lead-time days with the configured production day, not a calendar day', () => {
    // Same line, two shifts. Demand still binds (400/day capacity vs 200/day
    // demand), so lead time stays 2 days — but a day is now 960 min of
    // production, so the same processing time is a smaller share: 28.8 / 1920.
    const result = calculateKpis({
      processes: Array.from({ length: 12 }, () => ({ cycleTime: 2.4 })),
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
      availableMinutesPerDay: 960,
    })

    expect(result.totalLeadTimeDays).toBeCloseTo(2, 5)
    expect(result.valueAddedRatioPercent).toBeCloseTo(1.5, 5)
  })

  it('counts the full processing time of a multi-operator station in the VA ratio', () => {
    // One station, 10 min of work per unit, two operators -> 96 units/day.
    // 400 units of WIP leave at 96/day = 4.1667 days; a working day is 480 min.
    // VA = 10 / (4.1667 * 480) = 0.5%. Halving the numerator (the old bug)
    // would have reported 0.25%.
    const result = calculateKpis({
      processes: [{ cycleTime: 10, operatorCount: 2 }],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.totalCycleTimeMinutes).toBe(10)
    expect(result.totalLeadTimeDays).toBeCloseTo(4.1667, 3)
    expect(result.valueAddedRatioPercent).toBeCloseTo(0.5, 3)
  })

  it('returns null value-added ratio when there is no WIP at all', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 10 }],
      buffers: [],
      annualThroughput: 50_000,
    })

    expect(result.totalLeadTimeDays).toBe(0)
    expect(result.valueAddedRatioPercent).toBeNull()
  })

  it('computes takt time as shift minutes over daily demand when availableMinutesPerDay is not set', () => {
    const result = calculateKpis({
      processes: [],
      buffers: [],
      annualThroughput: 50_000, // daily demand 200
    })

    expect(result.taktTimeMinutes).toBeCloseTo(SHIFT_MINUTES / 200, 5)
  })

  it('uses availableMinutesPerDay for takt time when explicitly set (e.g. two shifts)', () => {
    const result = calculateKpis({
      processes: [],
      buffers: [],
      annualThroughput: 50_000, // daily demand 200
      availableMinutesPerDay: 960, // two 8h shifts instead of the SHIFT_MINUTES default of one
    })

    expect(result.taktTimeMinutes).toBeCloseTo(960 / 200, 5)
  })

  it('changes the demand rate and the lead time with annual throughput, when demand is the binding rate', () => {
    const lowThroughput = calculateKpis({ processes: [], buffers: [{ wipCount: 400 }], annualThroughput: 25_000 })
    const highThroughput = calculateKpis({ processes: [], buffers: [{ wipCount: 400 }], annualThroughput: 100_000 })

    expect(lowThroughput.demandRatePerDay).toBe(100) // 25'000 / 250
    expect(highThroughput.demandRatePerDay).toBe(400) // 100'000 / 250
    expect(lowThroughput.totalLeadTimeDays).toBe(4) // 400 / 100
    expect(highThroughput.totalLeadTimeDays).toBe(1) // 400 / 400
  })
})

// The exit rate is what the line actually ships, set by its slowest station
// (the time trap) — not the customer demand. Conflating the two made lead time
// mathematically independent of every cycle time, so improving the bottleneck
// showed no effect at all. See the Black-Belt audit, finding 0.
describe("exit rate vs demand rate (Little's Law with the real departure rate)", () => {
  const exampleLine = [
    { cycleTime: 1.2, oee: 82 }, // Sägen
    { cycleTime: 3.4, oee: 78 }, // Drehen
    { cycleTime: 2.6, oee: 85 }, // Fräsen
    { cycleTime: 4.1, oee: 90 }, // Montage — the time trap
  ]

  it('derives the exit rate from the slowest station, not from the last one', () => {
    const result = calculateKpis({ processes: exampleLine, buffers: [], annualThroughput: 50_000 })

    // Montage: 4.1 / 0.90 = 4.5556 min -> 480 / 4.5556 = 105.4 units/day
    expect(result.bottleneckCycleTimeMinutes).toBeCloseTo(4.5556, 3)
    expect(result.exitRatePerDay).toBeCloseTo(105.37, 1)
  })

  it('keeps the demand rate separate and uses it for takt time only', () => {
    const result = calculateKpis({ processes: exampleLine, buffers: [], annualThroughput: 50_000 })

    expect(result.demandRatePerDay).toBe(200)
    expect(result.taktTimeMinutes).toBeCloseTo(2.4, 5)
  })

  it('reports capacity coverage below 1 when the line cannot meet demand', () => {
    const result = calculateKpis({ processes: exampleLine, buffers: [], annualThroughput: 50_000 })

    expect(result.capacityCoverage).toBeCloseTo(0.527, 2)
  })

  it('uses the exit rate for lead time when the line is the binding constraint', () => {
    const result = calculateKpis({
      processes: exampleLine,
      buffers: [{ wipCount: 800 }, { wipCount: 400 }, { wipCount: 600 }],
      annualThroughput: 50_000,
    })

    // 1800 units of WIP leaving at 105.4/day, not at the 200/day the customer
    // asks for -> 17.1 days, nearly double the old demand-based 9.0.
    expect(result.totalLeadTimeDays).toBeCloseTo(17.08, 1)
  })

  it('improving the bottleneck shortens the lead time — the whole point of a VSM', () => {
    const buffers = [{ wipCount: 800 }, { wipCount: 400 }, { wipCount: 600 }]
    const before = calculateKpis({ processes: exampleLine, buffers, annualThroughput: 50_000 })

    const improved = exampleLine.map((p) => (p.cycleTime === 4.1 ? { ...p, cycleTime: 2.0 } : p))
    const after = calculateKpis({ processes: improved, buffers, annualThroughput: 50_000 })

    expect(after.totalLeadTimeDays!).toBeLessThan(before.totalLeadTimeDays!)
    // Drehen (3.4 / 0.78 = 4.359 min) becomes the new time trap.
    expect(after.bottleneckCycleTimeMinutes).toBeCloseTo(4.359, 2)
  })

  it('never ships faster than the customer pulls: demand caps the rate used for lead time', () => {
    // A fast line (0.5 min/station) could do 960/day, but the customer only
    // takes 200/day — the extra capacity does not drain inventory faster.
    const result = calculateKpis({
      processes: [{ cycleTime: 0.5 }, { cycleTime: 0.5 }],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.exitRatePerDay).toBeCloseTo(960, 1)
    expect(result.capacityCoverage).toBeCloseTo(4.8, 2)
    expect(result.totalLeadTimeDays).toBeCloseTo(2, 5) // 400 / 200, not 400 / 960
  })

  it('computes a lead time from the line alone when no demand is known yet', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 4.8 }],
      buffers: [{ wipCount: 400 }],
      annualThroughput: null,
    })

    expect(result.demandRatePerDay).toBeNull()
    expect(result.exitRatePerDay).toBeCloseTo(100, 5) // 480 / 4.8
    expect(result.totalLeadTimeDays).toBeCloseTo(4, 5) // 400 / 100
  })

  it('reports an unknown lead time when a station has zero OEE (no capacity)', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 4, oee: 0 }],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.exitRatePerDay).toBe(0)
    expect(result.capacityCoverage).toBe(0)
    expect(result.totalLeadTimeDays).toBeNull()
  })

  it('does not derate capacity when a process carries no OEE value', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 4.8 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(result.exitRatePerDay).toBeCloseTo(100, 5)
  })
})
