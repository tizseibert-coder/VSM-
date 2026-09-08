import { describe, expect, it } from 'vitest'
import { currencyForCountry, formatAmount, tierPriceParams } from './currency'

describe('currencyForCountry', () => {
  it('returns CHF for Switzerland', () => {
    expect(currencyForCountry('CH')).toBe('CHF')
  })

  // Der haeufigere Fall in der Entwicklung: Die Vercel-Kopfzeile fehlt
  // lokal und bei jedem anderen Hoster komplett, nicht nur gelegentlich.
  it.each([null, undefined, '', 'DE', 'AT', 'US', 'XX'])(
    'returns EUR for anything that is not CH (%s)',
    (country) => {
      expect(currencyForCountry(country)).toBe('EUR')
    }
  )
})

describe('formatAmount', () => {
  it('formats a euro amount without decimals', () => {
    expect(formatAmount(12, 'EUR', 'de')).toBe('12 €')
  })

  it('formats a franc amount without decimals', () => {
    // Intl schreibt CHF-Betraege im Deutschen ueblicherweise als "CHF 12.00" —
    // mit maximumFractionDigits: 0 wird daraus "CHF 12", die Nachkommastellen
    // sind hier nie relevant (alle Betraege sind runde Zahlen).
    expect(formatAmount(49, 'CHF', 'de')).not.toContain('.00')
    expect(formatAmount(49, 'CHF', 'de')).toContain('49')
  })

  it('formats zero as a real amount, not an empty string', () => {
    expect(formatAmount(0, 'EUR', 'de')).toContain('0')
  })
})

describe('tierPriceParams', () => {
  it('gives FREE a formatted zero', () => {
    expect(tierPriceParams('FREE', 'EUR', 'de').price).toContain('0')
  })

  it('gives STARTER and PROFESSIONAL their configured amount', () => {
    expect(tierPriceParams('STARTER', 'EUR', 'de').price).toContain('12')
    expect(tierPriceParams('PROFESSIONAL', 'CHF', 'de').price).toContain('49')
  })

  // ENTERPRISE hat keinen Betrag ("Preis auf Anfrage") — eine leere
  // Zeichenkette statt eines geratenen Wertes, den niemand angezeigt hat.
  it('gives ENTERPRISE and BETA an empty price', () => {
    expect(tierPriceParams('ENTERPRISE', 'EUR', 'de').price).toBe('')
    expect(tierPriceParams('BETA', 'EUR', 'de').price).toBe('')
  })
})
