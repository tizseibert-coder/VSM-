import { describe, expect, it } from 'vitest'
import { ratePce, rateCapacityCoverage } from './kpiRating'

// Only two KPIs get a rating, because only these two have a defensible
// reference. Bearbeitungszeit, Durchlaufzeit and Taktzeit are neither good nor
// bad in themselves — a chip next to them would invent a judgement.

describe('ratePce — Process Cycle Efficiency', () => {
  it('returns null when the ratio is unknown', () => {
    expect(ratePce(null)).toBeNull()
  })

  it('rates a quarter of the lead time or more as top', () => {
    expect(ratePce(25)).toBe('top')
    expect(ratePce(40)).toBe('top')
  })

  it('rates a tenth or more as good', () => {
    expect(ratePce(10)).toBe('good')
    expect(ratePce(24.9)).toBe('good')
  })

  it('rates a twentieth or more as average', () => {
    expect(ratePce(5)).toBe('average')
    expect(ratePce(9.9)).toBe('average')
  })

  it('rates anything below a twentieth as needing work', () => {
    expect(ratePce(4.9)).toBe('below')
    // The seeded example lands at 0.14 % — the whole point of drawing a VSM.
    expect(ratePce(0.14)).toBe('below')
  })

  it('never rates a lower ratio better than a higher one', () => {
    const order = ['top', 'good', 'average', 'below']
    const tiers = [40, 20, 7, 1].map((v) => order.indexOf(ratePce(v)!))

    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
  })
})

describe('rateCapacityCoverage — can the line meet demand?', () => {
  it('returns null when demand or capacity is unknown', () => {
    expect(rateCapacityCoverage(null)).toBeNull()
  })

  it('rates comfortable headroom as top', () => {
    expect(rateCapacityCoverage(1.2)).toBe('top')
  })

  it('rates just meeting demand as good', () => {
    expect(rateCapacityCoverage(1)).toBe('good')
    expect(rateCapacityCoverage(1.19)).toBe('good')
  })

  it('rates a small shortfall as average', () => {
    expect(rateCapacityCoverage(0.95)).toBe('average')
  })

  it('rates a real shortfall as below', () => {
    expect(rateCapacityCoverage(0.89)).toBe('below')
    // The seeded example covers 53 % of demand.
    expect(rateCapacityCoverage(0.527)).toBe('below')
  })
})
