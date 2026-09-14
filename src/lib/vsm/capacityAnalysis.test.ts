import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKDAYS_PER_MONTH,
  calcCamaLine,
  calcLoadRate,
  calcMonthlyCapacity,
  getCamaColor,
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
