import { describe, expect, it } from 'vitest'
import {
  calcDlp,
  calcKmix,
  deviationPct,
  estimateUtHours,
  kpiRow,
  median,
  rateDeviation,
  rateHigherIsBetter,
  rateKmix,
  rateLowerIsBetter,
  resolveKmixTarget,
} from './kpi'
import { DEFAULT_SETTINGS } from './settings'

const T = DEFAULT_SETTINGS.thresholds

describe('DLP and Kmix', () => {
  it('computes DLP = UT × f − OT', () => {
    expect(calcDlp(100, 40, 0.5)).toBe(10)
    expect(calcDlp(60, 40, 0.5)).toBe(-10)
  })

  it('makes DLP exactly zero at Kmix = 1 / f', () => {
    const f = 0.4
    const ot = 30
    const ut = ot / f
    expect(calcKmix(ut, ot)).toBeCloseTo(1 / f, 10)
    expect(calcDlp(ut, ot, f)).toBeCloseTo(0, 10)
  })

  it('has no Kmix without OT', () => {
    expect(calcKmix(10, 0)).toBeNull()
  })
})

describe('resolveKmixTarget', () => {
  it('derives the target from the factor when one is set', () => {
    expect(resolveKmixTarget({ dlpFactor: 0.5 }, [])).toEqual({ target: 2, source: 'factor' })
  })

  it('waits for ten days of Kmix without a factor', () => {
    expect(resolveKmixTarget({ dlpFactor: null }, [1.1, null, 1.2])).toEqual({ target: null, source: 'pending', daysMissing: 8 })
  })

  it('uses the median of the first ten days, so one bad day does not set the baseline', () => {
    const history = [1.2, 1.2, 1.2, 1.2, 0.1, 1.2, 1.2, 1.2, 1.2, 1.2, 5, 5]
    expect(resolveKmixTarget({ dlpFactor: null }, history)).toEqual({ target: 1.2, source: 'baseline', days: 10 })
  })

  it('computes medians for odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})

describe('estimateUtHours', () => {
  it('counts shots × cycle time, one shot giving as many parts as the tool has cavities', () => {
    // 3600 Gutteile, 4 Kavitaeten → 900 Schuesse × 20 s = 5 h
    expect(estimateUtHours({ goodParts: 3600, cycleTimeSeconds: 20, cavities: 4 })).toBe(5)
  })

  it('charges machine time for scrap as well', () => {
    expect(estimateUtHours({ goodParts: 340, badParts: 20, cycleTimeSeconds: 10, cavities: 1 })).toBe(1)
  })

  it('is zero for missing inputs instead of NaN', () => {
    expect(estimateUtHours({ goodParts: 100, cycleTimeSeconds: 20, cavities: 0 })).toBe(0)
  })
})

describe('Ampeln', () => {
  it('rates deviation by its magnitude, the threshold still green', () => {
    expect(deviationPct(100, 103)).toBeCloseTo(3)
    expect(rateDeviation(3, T.deviationPct)).toBe('green')
    expect(rateDeviation(-5, T.deviationPct)).toBe('yellow')
    expect(rateDeviation(8.1, T.deviationPct)).toBe('red')
    expect(rateDeviation(null, T.deviationPct)).toBeNull()
  })

  it('rates DLP: ≥ 0 green, ≥ −5 yellow', () => {
    expect(rateHigherIsBetter(0, T.dlp)).toBe('green')
    expect(rateHigherIsBetter(-5, T.dlp)).toBe('yellow')
    expect(rateHigherIsBetter(-5.1, T.dlp)).toBe('red')
  })

  it('rates Kmix against the target: reached green, 90 % yellow', () => {
    expect(rateKmix(2, 2, T.kmixShareOfTarget)).toBe('green')
    expect(rateKmix(1.8, 2, T.kmixShareOfTarget)).toBe('yellow')
    expect(rateKmix(1.79, 2, T.kmixShareOfTarget)).toBe('red')
    expect(rateKmix(1.5, null, T.kmixShareOfTarget)).toBeNull()
  })

  it('rates start offset and unplanned changeovers lower-is-better', () => {
    expect(rateLowerIsBetter(15, T.startOffsetMin)).toBe('green')
    expect(rateLowerIsBetter(31, T.startOffsetMin)).toBe('red')
    expect(rateLowerIsBetter(3, T.unplannedPerWeek)).toBe('yellow')
  })

  it('builds the Soll · Ist · Δ row', () => {
    expect(kpiRow('ut', 100, 95, 'yellow')).toEqual({ key: 'ut', soll: 100, ist: 95, delta: -5, ampel: 'yellow' })
    expect(kpiRow('ot', null, 40, null).delta).toBeNull()
  })
})
