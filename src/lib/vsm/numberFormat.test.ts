import { describe, expect, it } from 'vitest'
import { formatCount, formatDecimal, formatPlain, formatValues, roundTo } from './numberFormat'

describe('formatDecimal', () => {
  // Der Befund, der dieses Modul ausgeloest hat: "84.5 Tage" in einer
  // deutschen Oberflaeche, waehrend die Startseite daneben "16,8" schrieb.
  it('writes the decimal mark of the reader language', () => {
    expect(formatDecimal(84.5, 'de')).toBe('84,5')
    expect(formatDecimal(84.5, 'en')).toBe('84.5')
  })

  it('keeps the requested precision even when it is a round number', () => {
    expect(formatDecimal(2, 'de')).toBe('2,0')
    expect(formatDecimal(0.034, 'de', 2)).toBe('0,03')
  })

  it('groups thousands', () => {
    expect(formatDecimal(12345.6, 'de')).toBe('12.345,6')
    expect(formatDecimal(12345.6, 'en')).toBe('12,345.6')
  })
})

describe('formatCount', () => {
  it('writes whole pieces with a thousands separator', () => {
    expect(formatCount(9300, 'de')).toBe('9.300')
    expect(formatCount(9300, 'en')).toBe('9,300')
  })

  it('drops the decimals of a count', () => {
    expect(formatCount(9300.4, 'de')).toBe('9.300')
  })
})

describe('formatPlain', () => {
  // Eingetippte Werte behalten ihre Genauigkeit: Wer 0,75 min eingetragen
  // hat, soll in der Prozessbox nicht 0,8 lesen.
  it('keeps the precision the value came with', () => {
    expect(formatPlain(0.75, 'de')).toBe('0,75')
    expect(formatPlain(1.2, 'de')).toBe('1,2')
    expect(formatPlain(12, 'de')).toBe('12')
  })
})

describe('roundTo', () => {
  it('rounds to the given number of digits', () => {
    expect(roundTo(2.44, 1)).toBe(2.4)
    expect(roundTo(2.45, 1)).toBe(2.5)
    expect(roundTo(2.449, 2)).toBe(2.45)
  })
})

describe('formatValues', () => {
  // next-intl reicht Zahlen in {platzhalter} unformatiert durch — deshalb
  // gibt es diese Funktion ueberhaupt.
  it('formats the numbers of a message and leaves text alone', () => {
    expect(formatValues({ wip: 9300, rate: 110.05, name: 'Drehen' }, 'de')).toEqual({
      wip: '9.300',
      rate: '110,05',
      name: 'Drehen',
    })
  })

  it('does not add decimals a whole number never had', () => {
    expect(formatValues({ count: 3 }, 'de')).toEqual({ count: '3' })
  })
})
