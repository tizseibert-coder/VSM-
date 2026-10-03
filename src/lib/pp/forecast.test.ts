import { describe, expect, it } from 'vitest'
import { calcConfidence, confidenceLevel, dataAmountScore, dispersionScore, forecastUt } from './forecast'

describe('confidence', () => {
  it('grows with the square root of the data amount and caps at 30 days', () => {
    expect(dataAmountScore(0)).toBe(0)
    expect(dataAmountScore(30)).toBe(1)
    expect(dataAmountScore(90)).toBe(1)
    expect(dataAmountScore(7.5)).toBeCloseTo(0.5)
  })

  it('rewards low dispersion', () => {
    expect(dispersionScore([1, 1, 1])).toBe(1)
    expect(dispersionScore([1])).toBe(0)
    expect(dispersionScore([0.5, 1.5])).toBeLessThan(dispersionScore([0.95, 1.05]))
  })

  it('weights data amount 60 % and dispersion 40 %', () => {
    // 30 identische Werte: beide Anteile voll → 100 %
    expect(calcConfidence(Array(30).fill(1)).percent).toBe(100)
    // 30 Werte, sehr starke Streuung → nur der Mengen-Anteil
    const wild = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.01 : 10))
    expect(calcConfidence(wild).percent).toBe(60)
  })

  it('uses at most the last 60 days', () => {
    expect(calcConfidence(Array(100).fill(1)).daysUsed).toBe(60)
  })

  it('maps percent to high/medium/low at 80 and 50', () => {
    expect(confidenceLevel(80)).toBe('high')
    expect(confidenceLevel(79)).toBe('medium')
    expect(confidenceLevel(50)).toBe('medium')
    expect(confidenceLevel(49)).toBe('low')
  })
})

describe('forecastUt', () => {
  it('starts from the plan when there is no history yet', () => {
    const f = forecastUt(100, [])
    expect(f).toMatchObject({ value: 100, basis: 'blended', realization: 1, historyWeight: 0 })
    expect(f.confidence.level).toBe('low')
  })

  it('moves towards the own realization as days come in', () => {
    const day = { utActual: 80, utPlanned: 100 }
    const after5 = forecastUt(100, Array(5).fill(day))
    const after30 = forecastUt(100, Array(30).fill(day))
    expect(after5.value).toBeGreaterThan(80)
    expect(after5.value).toBeLessThan(100)
    expect(after30.value).toBeCloseTo(80)
  })

  it('falls back to the mean of actual UT when the plan has no cycle times', () => {
    const f = forecastUt(null, [
      { utActual: 90, utPlanned: null },
      { utActual: 110, utPlanned: null },
    ])
    expect(f).toMatchObject({ value: 100, basis: 'history-only' })
  })

  it('gives no number rather than an invented one', () => {
    expect(forecastUt(null, []).value).toBeNull()
  })
})
