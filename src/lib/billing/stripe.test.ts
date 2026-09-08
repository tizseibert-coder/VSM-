import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPurchasableTier,
  isTierPurchasable,
  priceIdForTier,
  resolveSubscriptionOutcome,
  tierForPriceId,
} from './stripe'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  process.env.STRIPE_PRICE_STARTER_EUR = 'price_starter_eur_test'
  process.env.STRIPE_PRICE_STARTER_CHF = 'price_starter_chf_test'
  process.env.STRIPE_PRICE_PROFESSIONAL_EUR = 'price_professional_eur_test'
  process.env.STRIPE_PRICE_PROFESSIONAL_CHF = 'price_professional_chf_test'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isPurchasableTier', () => {
  it('accepts only STARTER and PROFESSIONAL', () => {
    expect(isPurchasableTier('STARTER')).toBe(true)
    expect(isPurchasableTier('PROFESSIONAL')).toBe(true)
    expect(isPurchasableTier('FREE')).toBe(false)
    expect(isPurchasableTier('ENTERPRISE')).toBe(false)
    expect(isPurchasableTier('BETA')).toBe(false)
  })
})

describe('isTierPurchasable', () => {
  it('is true once secret key and both currencies are set', () => {
    expect(isTierPurchasable('STARTER')).toBe(true)
    expect(isTierPurchasable('PROFESSIONAL')).toBe(true)
  })

  it('is false without the secret key, even with both prices set', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(isTierPurchasable('STARTER')).toBe(false)
  })

  // Der Fall, den isTierPurchasable extra abfaengt: eine Waehrung konfiguriert,
  // die andere noch nicht — der Knopf darf nicht erscheinen, bevor beide
  // stehen, sonst scheitert die Haelfte der Besucher erst beim Klick.
  it('is false when only one of the two currencies is set', () => {
    delete process.env.STRIPE_PRICE_STARTER_CHF
    expect(isTierPurchasable('STARTER')).toBe(false)
  })
})

describe('priceIdForTier', () => {
  it('returns the price id for the requested currency', () => {
    expect(priceIdForTier('STARTER', 'EUR')).toBe('price_starter_eur_test')
    expect(priceIdForTier('STARTER', 'CHF')).toBe('price_starter_chf_test')
    expect(priceIdForTier('PROFESSIONAL', 'CHF')).toBe('price_professional_chf_test')
  })

  it('throws when the specific currency is not configured', () => {
    delete process.env.STRIPE_PRICE_PROFESSIONAL_EUR
    expect(() => priceIdForTier('PROFESSIONAL', 'EUR')).toThrow(
      /STRIPE_PRICE_PROFESSIONAL_EUR/
    )
  })
})

describe('tierForPriceId', () => {
  it('maps a known Stripe price id back to its tier, in either currency', () => {
    expect(tierForPriceId('price_starter_eur_test')).toBe('STARTER')
    expect(tierForPriceId('price_starter_chf_test')).toBe('STARTER')
    expect(tierForPriceId('price_professional_eur_test')).toBe('PROFESSIONAL')
    expect(tierForPriceId('price_professional_chf_test')).toBe('PROFESSIONAL')
  })

  // Der Fall, der bei einer falsch abgetippten Preis-Id sonst erst beim
  // ersten echten Kauf auffiele: ein unbekannter Preis ergibt null statt
  // eines geratenen Tarifs.
  it('returns null for an unknown price id', () => {
    expect(tierForPriceId('price_does_not_exist')).toBeNull()
  })

  it('returns null when the environment variable itself is unset', () => {
    delete process.env.STRIPE_PRICE_STARTER_EUR
    expect(tierForPriceId('price_starter_eur_test')).toBeNull()
  })
})

describe('resolveSubscriptionOutcome', () => {
  it('grants the tier when the subscription is active', () => {
    expect(resolveSubscriptionOutcome('active', 'price_starter_chf_test')).toEqual({
      tier: 'STARTER',
    })
  })

  it('grants the tier during a trial, regardless of which currency the price is', () => {
    expect(resolveSubscriptionOutcome('trialing', 'price_professional_eur_test')).toEqual({
      tier: 'PROFESSIONAL',
    })
  })

  // Der Fall, der Geld kostet, wenn er falsch herum implementiert ist: eine
  // Kuendigung oder ein Zahlungsausfall darf niemals als "tier" zurueckkommen.
  it.each(['past_due', 'canceled', 'unpaid', 'incomplete_expired', 'paused'] as const)(
    'revokes on status %s',
    (status) => {
      expect(resolveSubscriptionOutcome(status, 'price_starter_eur_test')).toEqual({
        revoke: true,
      })
    }
  )

  it('revokes when the price is not one of ours, even if the status is active', () => {
    expect(resolveSubscriptionOutcome('active', 'price_unrelated')).toEqual({ revoke: true })
  })

  it('revokes when there is no price at all', () => {
    expect(resolveSubscriptionOutcome('active', null)).toEqual({ revoke: true })
  })
})
