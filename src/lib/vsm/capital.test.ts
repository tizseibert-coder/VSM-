import { describe, expect, it } from 'vitest'
import { formatCurrency, releasedCapital, tiedUpCapital } from './capital'

describe('tiedUpCapital', () => {
  it('multiplies the stock by the value of one piece', () => {
    expect(tiedUpCapital(9300, 50)).toBe(465000)
  })

  // Ohne hinterlegten Stueckwert darf keine Zahl entstehen: Eine 0 waere die
  // Behauptung "es liegt kein Geld im Bestand", und genau die stimmt nie.
  it('returns null when no piece value is set', () => {
    expect(tiedUpCapital(9300, null)).toBeNull()
  })

  it('treats zero or a negative piece value as not set', () => {
    expect(tiedUpCapital(9300, 0)).toBeNull()
    expect(tiedUpCapital(9300, -5)).toBeNull()
  })

  it('is zero when the stream carries no stock at all', () => {
    expect(tiedUpCapital(0, 50)).toBe(0)
  })
})

describe('releasedCapital', () => {
  it('reports what a scenario frees up against the current state', () => {
    expect(releasedCapital(465000, 232500)).toBe(232500)
  })

  // Ein Szenario darf Bestand aufbauen — ein Supermarkt vor dem Schrittmacher
  // ist genau das. Dann steht dort ein Minus, und das ist die Aussage.
  it('reports a negative figure when the scenario builds stock up', () => {
    expect(releasedCapital(200000, 260000)).toBe(-60000)
  })

  it('stays unknown as long as one side is unknown', () => {
    expect(releasedCapital(null, 232500)).toBeNull()
    expect(releasedCapital(465000, null)).toBeNull()
  })
})

describe('formatCurrency', () => {
  // Der Grund fuer dieses Modul: Im Editor stand bisher toFixed() und damit
  // "84.5" in einer deutschen Oberflaeche.
  it('follows the reader language, not the source code', () => {
    expect(formatCurrency(465000, 'EUR', 'de')).toMatch(/465\.000/)
    expect(formatCurrency(465000, 'EUR', 'en')).toMatch(/465,000/)
  })

  it('carries the currency of the project, not a hardcoded one', () => {
    expect(formatCurrency(1000, 'CHF', 'de')).toMatch(/CHF/)
    expect(formatCurrency(1000, 'EUR', 'de')).toMatch(/€/)
  })

  it('rounds to whole units — the input is an estimate, not an invoice', () => {
    expect(formatCurrency(1234.56, 'EUR', 'de')).not.toMatch(/,5/)
  })
})
