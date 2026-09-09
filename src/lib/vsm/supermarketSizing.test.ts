import { describe, expect, it } from 'vitest'
import {
  SERVICE_LEVEL_Z,
  isIntervalBasis,
  parseUsageSeries,
  sizeFifoLane,
  sizeSupermarket,
  suggestPltDays,
  summariseUsageSeries,
} from './supermarketSizing'

describe('sizeSupermarket', () => {
  // 2 Tage x 100 Stk = 200 Zyklusbestand, 2,06 x 20 x Wurzel(4) = 82,4 Safety,
  // 4 Tage x 100 Stk = 400 PLT-Stock. Summe 682,4, aufgerundet 683.
  it('adds cycle stock, safety stock and PLT stock', () => {
    const result = sizeSupermarket({ aduPerDay: 100, aduStdDev: 20, intervalDays: 2, pltDays: 4 })
    expect(result).toEqual({ cycleStock: 200, safetyStock: 82.4, pltStock: 400, totalPieces: 683 })
  })

  // Ein halbes Stueck kann nicht im Regal liegen, und Abrunden unterdeckt.
  it('rounds the total up, never down', () => {
    const result = sizeSupermarket({ aduPerDay: 10, aduStdDev: 0, intervalDays: 0.01, pltDays: 0 })
    expect(result?.totalPieces).toBe(1)
  })

  it('scales the safety stock with the square root of the lead time', () => {
    const short = sizeSupermarket({ aduPerDay: 0, aduStdDev: 10, intervalDays: 0, pltDays: 1 })
    const long = sizeSupermarket({ aduPerDay: 0, aduStdDev: 10, intervalDays: 0, pltDays: 4 })
    // Vierfache Durchlaufzeit heisst doppelte Streuungsdeckung, nicht vierfache.
    expect(long?.safetyStock).toBeCloseTo((short?.safetyStock ?? 0) * 2, 5)
    expect(short?.safetyStock).toBeCloseTo(SERVICE_LEVEL_Z * 10, 5)
  })

  it('carries no safety stock when the usage does not vary', () => {
    const result = sizeSupermarket({ aduPerDay: 50, aduStdDev: 0, intervalDays: 1, pltDays: 2 })
    expect(result?.safetyStock).toBe(0)
    expect(result?.totalPieces).toBe(150)
  })

  it('is zero pieces when nothing is consumed and nothing varies', () => {
    const result = sizeSupermarket({ aduPerDay: 0, aduStdDev: 0, intervalDays: 3, pltDays: 5 })
    expect(result?.totalPieces).toBe(0)
  })

  // Null heisst "nicht bemessbar", nicht "null Stueck" — sonst waere das
  // Ergebnis ein Supermarkt, der leer sein darf.
  it('stays unknown when an input is missing or nonsensical', () => {
    expect(sizeSupermarket({ aduPerDay: NaN, aduStdDev: 20, intervalDays: 2, pltDays: 4 })).toBeNull()
    expect(sizeSupermarket({ aduPerDay: 100, aduStdDev: -1, intervalDays: 2, pltDays: 4 })).toBeNull()
    expect(sizeSupermarket({ aduPerDay: 100, aduStdDev: 20, intervalDays: -2, pltDays: 4 })).toBeNull()
    expect(sizeSupermarket({ aduPerDay: 100, aduStdDev: 20, intervalDays: 2, pltDays: Infinity })).toBeNull()
  })
})

describe('sizeFifoLane', () => {
  // Kein Nachfuellintervall und kein Streuungsvorrat: Der Nachfolger einer
  // FIFO-Bahn waehlt nicht aus. Bleibt der PLT-Stock allein.
  it('caps the lane at the allowed wait times the daily usage', () => {
    expect(sizeFifoLane(120, 0.5)).toBe(60)
  })

  it('rounds up like the supermarket total', () => {
    expect(sizeFifoLane(100, 0.125)).toBe(13)
  })

  it('stays unknown without a usage or a wait', () => {
    expect(sizeFifoLane(NaN, 0.5)).toBeNull()
    expect(sizeFifoLane(120, -1)).toBeNull()
  })
})

describe('suggestPltDays', () => {
  // Ohne den Abzug beisst sich die Rechnung in den Schwanz: Die Sollgroesse
  // landet als WIP in genau der PLT, aus der sie berechnet wurde.
  it('subtracts what this buffer itself contributes to the lead time', () => {
    // 9,3 Tage gesamt, 200 Stk bei 100 Stk/Tag sind 2 Tage davon.
    expect(suggestPltDays(9.3, 100, 200)).toBe(7.3)
  })

  it('never goes negative when one buffer carries the whole lead time', () => {
    expect(suggestPltDays(2, 100, 500)).toBe(0)
  })

  it('leaves an empty buffer the full lead time', () => {
    expect(suggestPltDays(9.3, 100, 0)).toBe(9.3)
  })

  it('stays unknown without a lead time or a departure rate', () => {
    expect(suggestPltDays(null, 100, 200)).toBeNull()
    expect(suggestPltDays(9.3, null, 200)).toBeNull()
    expect(suggestPltDays(9.3, 0, 200)).toBeNull()
  })
})

describe('parseUsageSeries', () => {
  it('reads one number per line, the usual paste from a spreadsheet column', () => {
    expect(parseUsageSeries('120\n134\n98\n141')).toEqual([120, 134, 98, 141])
  })

  // Im Deutschen ist das Komma das Dezimalzeichen, nicht der Trenner — an ihm
  // zu trennen wuerde aus "12,4" die beiden Zahlen 12 und 4 machen.
  it('treats a comma as a decimal mark, not a separator', () => {
    expect(parseUsageSeries('12,4\n13,6')).toEqual([12.4, 13.6])
    expect(parseUsageSeries('12.4\n13.6')).toEqual([12.4, 13.6])
  })

  it('accepts spaces, tabs and semicolons as separators', () => {
    expect(parseUsageSeries('120 134\t98;141')).toEqual([120, 134, 98, 141])
  })

  it('drops blank lines and anything that is not a number', () => {
    expect(parseUsageSeries('120\n\n  \nStk\n134\n-5')).toEqual([120, 134])
  })

  it('is empty for empty input', () => {
    expect(parseUsageSeries('')).toEqual([])
    expect(parseUsageSeries('   \n  ')).toEqual([])
  })
})

describe('summariseUsageSeries', () => {
  // Mittelwert 6, Abweichungen -4/-2/0/2/4, Quadratsumme 40, geteilt durch
  // n-1 = 4 ergibt Varianz 10, Wurzel 3,16.
  it('reports the mean as ADU and the sample standard deviation as sigma', () => {
    const summary = summariseUsageSeries([2, 4, 6, 8, 10])
    expect(summary).toEqual({ aduPerDay: 6, aduStdDev: 3.16, sampleCount: 5 })
  })

  it('reports no variation for a perfectly steady usage', () => {
    expect(summariseUsageSeries([50, 50, 50])).toEqual({
      aduPerDay: 50,
      aduStdDev: 0,
      sampleCount: 3,
    })
  })

  // Aus einem einzigen Tag laesst sich keine Streuung ableiten. Eine 0 wuerde
  // behaupten, der Verbrauch schwanke nicht.
  it('stays unknown below two values', () => {
    expect(summariseUsageSeries([120])).toBeNull()
    expect(summariseUsageSeries([])).toBeNull()
  })
})

describe('isIntervalBasis', () => {
  it('accepts the three bases the column allows', () => {
    expect(isIntervalBasis('epei')).toBe(true)
    expect(isIntervalBasis('cti')).toBe(true)
    expect(isIntervalBasis('wq')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isIntervalBasis('')).toBe(false)
    expect(isIntervalBasis('EPEI')).toBe(false)
  })
})
