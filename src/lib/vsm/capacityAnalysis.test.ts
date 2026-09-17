import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKDAYS_PER_MONTH,
  calcAvailableHours,
  calcCamaHoursTrend,
  calcCamaLine,
  calcLoadRate,
  calcMonthlyCapacity,
  calcRequiredHours,
  getCamaColor,
  resolveMonthlyActualHours,
  resolveMonthlyValues,
  resolveWorkdaysCalendar,
  shiftHoursPerDay,
  type CamaLineInput,
} from './capacityAnalysis'

describe('shiftHoursPerDay', () => {
  it('maps 1/2/3-shift to 8.2/16.4/24 hours', () => {
    expect(shiftHoursPerDay(1)).toBe(8.2)
    expect(shiftHoursPerDay(2)).toBe(16.4)
    expect(shiftHoursPerDay(3)).toBe(24)
  })
})

describe('calcMonthlyCapacity', () => {
  it('reproduces the worked example from the CAMA template', () => {
    // 16.4h x 50 Stk/h x 0.68 = 557.6 Stk/Tag; x 21 Arbeitstage = 11709.6
    // (Vorlage rundet auf 557 bzw. 11700 — hier exakt.)
    const input: CamaLineInput = { cycleTimeMinutes: 60 / 50, neeFraction: 0.68, shiftModel: 2 }
    expect(calcMonthlyCapacity(input, 21)).toBeCloseTo(11709.6, 2)
  })

  it('doubles capacity for two truly identical parallel operators', () => {
    const oneOperator: CamaLineInput = { cycleTimeMinutes: 2, neeFraction: 1, shiftModel: 3 }
    const twoOperators: CamaLineInput = { ...oneOperator, operatorCount: 2 }
    expect(calcMonthlyCapacity(twoOperators, 20)).toBeCloseTo(calcMonthlyCapacity(oneOperator, 20) * 2, 5)
  })

  it('is zero capacity at 0% NEE, not Infinity/NaN', () => {
    const input: CamaLineInput = { cycleTimeMinutes: 2, neeFraction: 0, shiftModel: 2 }
    expect(calcMonthlyCapacity(input, 21)).toBe(0)
  })

  it('is zero capacity for an invalid (non-positive) cycle time', () => {
    const input: CamaLineInput = { cycleTimeMinutes: 0, neeFraction: 0.8, shiftModel: 2 }
    expect(calcMonthlyCapacity(input, 21)).toBe(0)
  })

  it('is zero capacity with zero workdays', () => {
    const input: CamaLineInput = { cycleTimeMinutes: 2, neeFraction: 0.8, shiftModel: 2 }
    expect(calcMonthlyCapacity(input, 0)).toBe(0)
  })
})

describe('calcLoadRate', () => {
  it('is 0 with no demand, regardless of capacity', () => {
    expect(calcLoadRate(0, 0)).toBe(0)
    expect(calcLoadRate(0, 1000)).toBe(0)
  })

  it('is Infinity with demand but no capacity', () => {
    expect(calcLoadRate(500, 0)).toBe(Infinity)
  })

  it('divides demand by capacity otherwise', () => {
    expect(calcLoadRate(11500, 11700)).toBeCloseTo(0.9829, 4)
  })
})

describe('getCamaColor', () => {
  it('is blue strictly below 0.5', () => {
    expect(getCamaColor(0.49)).toBe('blue')
    expect(getCamaColor(0)).toBe('blue')
  })

  it('is green from 0.5 up to and including 1.0 (boundary user-confirmed)', () => {
    expect(getCamaColor(0.5)).toBe('green')
    expect(getCamaColor(0.98)).toBe('green')
    expect(getCamaColor(1.0)).toBe('green')
  })

  it('is orange above 1.0 up to and including 1.2 (boundary user-confirmed)', () => {
    expect(getCamaColor(1.0001)).toBe('orange')
    expect(getCamaColor(1.1)).toBe('orange')
    expect(getCamaColor(1.2)).toBe('orange')
  })

  it('is red above 1.2', () => {
    expect(getCamaColor(1.2001)).toBe('red')
    expect(getCamaColor(2)).toBe('red')
  })

  it('treats Infinity (demand with zero capacity) as red', () => {
    expect(getCamaColor(Infinity)).toBe('red')
  })
})

describe('calcCamaLine', () => {
  const input: CamaLineInput = { cycleTimeMinutes: 60 / 50, neeFraction: 0.68, shiftModel: 2 }
  const workdays = Array(12).fill(21)

  it('computes all 12 months', () => {
    const demand = Array(12).fill(11500)
    const result = calcCamaLine(input, demand, workdays)
    expect(result.months).toHaveLength(12)
    expect(result.months[0].month).toBe(1)
    expect(result.months[11].month).toBe(12)
    expect(result.months.every((m) => m.color === 'green')).toBe(true)
  })

  it('picks the month with the highest load rate as peak, and its color as the line color', () => {
    const demand = [8000, 8000, 8000, 8000, 8000, 8000, 15000, 8000, 8000, 8000, 8000, 8000]
    const result = calcCamaLine(input, demand, workdays)
    expect(result.peakMonth.month).toBe(7)
    expect(result.peakMonth.color).toBe('red')
    expect(result.color).toBe('red')
  })

  it('applies per-month workdays (seasonal calendar)', () => {
    const demand = Array(12).fill(10000)
    const shortDecember = [...workdays]
    shortDecember[11] = 10 // Betriebsferien im Dezember
    const result = calcCamaLine(input, demand, shortDecember)
    expect(result.months[11].capacity).toBeLessThan(result.months[0].capacity)
    expect(result.peakMonth.month).toBe(12)
  })

  it('picks the earlier month on an exact tie', () => {
    const demand = [15000, 15000, ...Array(10).fill(8000)]
    const result = calcCamaLine(input, demand, workdays)
    expect(result.peakMonth.month).toBe(1)
  })

  it('treats a too-short or invalid demand array as no demand for the missing months, not NaN', () => {
    const demand = [11500, 11500] // nur 2 von 12 Monaten geliefert
    const result = calcCamaLine(input, demand, workdays)
    expect(result.months).toHaveLength(12)
    expect(result.months[2].demand).toBe(0)
    expect(result.months[2].loadRate).toBe(0)
    expect(result.months[2].color).toBe('blue')
    expect(Number.isNaN(result.peakMonth.loadRate)).toBe(false)
  })

  it('treats invalid workdays entries as the default calendar, not NaN', () => {
    const demand = Array(12).fill(10000)
    const brokenCalendar = Array(12).fill(21)
    brokenCalendar[3] = null as unknown as number
    const result = calcCamaLine(input, demand, brokenCalendar)
    expect(result.months[3].capacity).toBeCloseTo(calcMonthlyCapacity(input, DEFAULT_WORKDAYS_PER_MONTH), 5)
  })
})

describe('calcAvailableHours', () => {
  it('is shift hours/day times workdays', () => {
    expect(calcAvailableHours(2, 21)).toBeCloseTo(344.4, 5)
    expect(calcAvailableHours(1, 21)).toBeCloseTo(172.2, 5)
    expect(calcAvailableHours(3, 20)).toBe(480)
  })

  it('is zero with zero or negative workdays', () => {
    expect(calcAvailableHours(2, 0)).toBe(0)
    expect(calcAvailableHours(2, -1)).toBe(0)
  })
})

describe('calcRequiredHours', () => {
  const input: CamaLineInput = { cycleTimeMinutes: 60 / 50, neeFraction: 0.68, shiftModel: 2 }

  it('is the exact inverse of calcMonthlyCapacity: demand at full capacity needs all available hours', () => {
    const workdays = 21
    const demandAtFullCapacity = calcMonthlyCapacity(input, workdays)
    expect(calcRequiredHours(input, demandAtFullCapacity)).toBeCloseTo(calcAvailableHours(2, workdays), 5)
  })

  it('halves required hours for two truly identical parallel operators', () => {
    const oneOperator: CamaLineInput = { cycleTimeMinutes: 2, neeFraction: 1, shiftModel: 3 }
    const twoOperators: CamaLineInput = { ...oneOperator, operatorCount: 2 }
    expect(calcRequiredHours(twoOperators, 1000)).toBeCloseTo(calcRequiredHours(oneOperator, 1000) / 2, 5)
  })

  it('is zero for non-positive demand, cycle time, or NEE', () => {
    expect(calcRequiredHours(input, 0)).toBe(0)
    expect(calcRequiredHours({ ...input, cycleTimeMinutes: 0 }, 100)).toBe(0)
    expect(calcRequiredHours({ ...input, neeFraction: 0 }, 100)).toBe(0)
  })
})

describe('calcCamaHoursTrend', () => {
  const input: CamaLineInput = { cycleTimeMinutes: 60 / 50, neeFraction: 0.68, shiftModel: 2 }
  const workdays = Array(12).fill(21)

  it('computes all 12 months with required/available hours matching the standalone functions', () => {
    const demand = Array(12).fill(11500)
    const actual = Array(12).fill(300)
    const result = calcCamaHoursTrend(input, demand, actual, workdays)
    expect(result).toHaveLength(12)
    expect(result[0].month).toBe(1)
    expect(result[0].requiredHours).toBeCloseTo(calcRequiredHours(input, 11500), 5)
    expect(result[0].availableHours).toBeCloseTo(calcAvailableHours(2, 21), 5)
    expect(result[0].actualHours).toBe(300)
  })

  it('keeps a month null when no actual hours were entered, not 0', () => {
    const demand = Array(12).fill(11500)
    const actual = [300, null, null, null, null, null, null, null, null, null, null, null]
    const result = calcCamaHoursTrend(input, demand, actual, workdays)
    expect(result[0].actualHours).toBe(300)
    expect(result[1].actualHours).toBeNull()
  })

  it('treats a too-short actual-hours array as unset for the missing months, not NaN', () => {
    const demand = Array(12).fill(11500)
    const actual = [300, 310] // nur 2 von 12 Monaten geliefert
    const result = calcCamaHoursTrend(input, demand, actual, workdays)
    expect(result[2].actualHours).toBeNull()
  })
})

describe('resolveMonthlyActualHours', () => {
  it('keeps valid numbers and turns the rest into null', () => {
    const raw = [100, null, 'x', 130, undefined, 150, 160, 150, 140, 130, 120, 110]
    expect(resolveMonthlyActualHours(raw)).toEqual([100, null, null, 130, null, 150, 160, 150, 140, 130, 120, 110])
  })

  it('returns 12 null entries for anything that is not an array', () => {
    expect(resolveMonthlyActualHours(null)).toEqual(Array(12).fill(null))
    expect(resolveMonthlyActualHours({ 1: 100 })).toEqual(Array(12).fill(null))
  })

  it('pads a too-short array with null', () => {
    expect(resolveMonthlyActualHours([100, 200])).toEqual([100, 200, ...Array(10).fill(null)])
  })
})

describe('resolveMonthlyValues', () => {
  it('keeps valid numbers and fills the rest with the fallback', () => {
    const raw = [100, null, 'x', 130, undefined, 150, 160, 150, 140, 130, 120, 110]
    expect(resolveMonthlyValues(raw, 0)).toEqual([100, 0, 0, 130, 0, 150, 160, 150, 140, 130, 120, 110])
  })

  it('returns 12 fallback entries for anything that is not an array', () => {
    expect(resolveMonthlyValues(null, 5)).toEqual(Array(12).fill(5))
    expect(resolveMonthlyValues({ 1: 100 }, 5)).toEqual(Array(12).fill(5))
  })
})

describe('resolveWorkdaysCalendar', () => {
  it('reads month keys as strings and fills gaps with the default', () => {
    const raw = { '1': 21, '2': 20, '12': 22 }
    const result = resolveWorkdaysCalendar(raw)
    expect(result[0]).toBe(21)
    expect(result[1]).toBe(20)
    expect(result[11]).toBe(22)
    expect(result[5]).toBe(DEFAULT_WORKDAYS_PER_MONTH)
  })

  it('falls back to the default calendar entirely when the column is null', () => {
    expect(resolveWorkdaysCalendar(null)).toEqual(Array(12).fill(DEFAULT_WORKDAYS_PER_MONTH))
  })

  it('ignores non-positive or non-numeric entries', () => {
    const raw = { '1': 0, '2': -5, '3': 'x' }
    const result = resolveWorkdaysCalendar(raw)
    expect(result.slice(0, 3)).toEqual([
      DEFAULT_WORKDAYS_PER_MONTH,
      DEFAULT_WORKDAYS_PER_MONTH,
      DEFAULT_WORKDAYS_PER_MONTH,
    ])
  })

  it('accepts a custom fallback', () => {
    expect(resolveWorkdaysCalendar(null, 20)).toEqual(Array(12).fill(20))
  })
})
