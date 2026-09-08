import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPurchasableTier, resolveSubscriptionOutcome, tierForPriceId } from './stripe'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.STRIPE_PRICE_STARTER = 'price_starter_test'
  process.env.STRIPE_PRICE_PROFESSIONAL = 'price_professional_test'
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

describe('tierForPriceId', () => {
  it('maps a known Stripe price id back to its tier', () => {
    expect(tierForPriceId('price_starter_test')).toBe('STARTER')
    expect(tierForPriceId('price_professional_test')).toBe('PROFESSIONAL')
  })

  // Der Fall, der bei einer falsch abgetippten Preis-Id sonst erst beim
  // ersten echten Kauf auffiele: ein unbekannter Preis ergibt null statt
  // eines geratenen Tarifs.
  it('returns null for an unknown price id', () => {
    expect(tierForPriceId('price_does_not_exist')).toBeNull()
  })

  it('returns null when the environment variable itself is unset', () => {
    delete process.env.STRIPE_PRICE_STARTER
    expect(tierForPriceId('price_starter_test')).toBeNull()
  })
})

describe('resolveSubscriptionOutcome', () => {
  it('grants the tier when the subscription is active', () => {
    expect(resolveSubscriptionOutcome('active', 'price_starter_test')).toEqual({
      tier: 'STARTER',
    })
  })

  it('grants the tier during a trial', () => {
    expect(resolveSubscriptionOutcome('trialing', 'price_professional_test')).toEqual({
      tier: 'PROFESSIONAL',
    })
  })

  // Der Fall, der Geld kostet, wenn er falsch herum implementiert ist: eine
  // Kuendigung oder ein Zahlungsausfall darf niemals als "tier" zurueckkommen.
  it.each(['past_due', 'canceled', 'unpaid', 'incomplete_expired', 'paused'] as const)(
    'revokes on status %s',
    (status) => {
      expect(resolveSubscriptionOutcome(status, 'price_starter_test')).toEqual({ revoke: true })
    }
  )

  it('revokes when the price is not one of ours, even if the status is active', () => {
    expect(resolveSubscriptionOutcome('active', 'price_unrelated')).toEqual({ revoke: true })
  })

  it('revokes when there is no price at all', () => {
    expect(resolveSubscriptionOutcome('active', null)).toEqual({ revoke: true })
  })
})
