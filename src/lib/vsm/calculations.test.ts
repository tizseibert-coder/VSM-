import { describe, expect, it } from 'vitest'
import {
  SHIFT_MINUTES,
  WORKING_DAYS_PER_YEAR,
  calculateDailyDemand,
  calculateKpis,
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

describe('calculateKpis', () => {
  it('returns zeroed-out KPIs for an empty VSM', () => {
    const result = calculateKpis({ processes: [], buffers: [], annualThroughput: null })

    expect(result.totalCycleTimeMinutes).toBe(0)
    expect(result.totalLeadTimeDays).toBe(0)
    expect(result.valueAddedRatioPercent).toBeNull()
    expect(result.taktTimeMinutes).toBeNull()
    expect(result.dailyDemand).toBeNull()
  })

  it('sums cycle times across all processes', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 3.5 }, { cycleTime: 2 }, { cycleTime: 1.5 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(result.totalCycleTimeMinutes).toBe(7)
  })

  it("halves a process's cycle-time contribution when it has two operators", () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 10, operatorCount: 2 }],
      buffers: [],
      annualThroughput: null,
    })

    expect(result.totalCycleTimeMinutes).toBe(5)
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

  it('computes lead time in days from buffer WIP and daily demand', () => {
    // daily demand = 50'000 / 250 = 200 units/day
    // buffer of 400 units -> 2 days of supply
    const result = calculateKpis({
      processes: [],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.dailyDemand).toBe(200)
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
    // lead time = 2 days = 2880 minutes; processing time = 28.8 minutes -> 1%
    const result = calculateKpis({
      processes: [{ cycleTime: 28.8 }],
      buffers: [{ wipCount: 400 }],
      annualThroughput: 50_000,
    })

    expect(result.valueAddedRatioPercent).toBeCloseTo(1, 5)
  })

  it('returns null value-added ratio when lead time is zero', () => {
    const result = calculateKpis({
      processes: [{ cycleTime: 10 }],
      buffers: [],
      annualThroughput: 50_000,
    })

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

  it("changing annual throughput changes dailyDemand (exit rate) and lead time in the direction Little's Law predicts (PLT = WIP / exit rate)", () => {
    // Same WIP, higher annual throughput -> higher exit rate -> shorter lead time.
    const lowThroughput = calculateKpis({ processes: [], buffers: [{ wipCount: 400 }], annualThroughput: 25_000 })
    const highThroughput = calculateKpis({ processes: [], buffers: [{ wipCount: 400 }], annualThroughput: 100_000 })

    expect(lowThroughput.dailyDemand).toBe(100) // 25'000 / 250
    expect(highThroughput.dailyDemand).toBe(400) // 100'000 / 250
    expect(lowThroughput.totalLeadTimeDays).toBe(4) // 400 / 100
    expect(highThroughput.totalLeadTimeDays).toBe(1) // 400 / 400
    expect(highThroughput.totalLeadTimeDays).toBeLessThan(lowThroughput.totalLeadTimeDays)
  })
})
