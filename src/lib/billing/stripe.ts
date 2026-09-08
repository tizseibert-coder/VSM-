// Der Stripe-Client und die Zuordnung zwischen Tarif und Stripe-Preis.
//
// Nur STARTER und PROFESSIONAL sind selbstbedient — FREE braucht keine
// Zahlung, ENTERPRISE bleibt „Preis auf Anfrage" (siehe pricing/page.tsx).
// Die Betraege selbst stehen in lib/billing/plans.ts (MONTHLY_AMOUNT) und auf
// stripe.com, an zwei Stellen, aber nur eine davon ist die Abrechnung — die
// Umgebungsvariablen hier tragen nur die Preis-Ids, nie die Zahl.
//
// Jeder Tarif hat zwei Preise, nicht einen: Der Betrieb rechnet in Franken
// ab, verkauft aber auch ausserhalb der Schweiz — und ein einzelner
// Stripe-Preis traegt eine fest eingebaute Waehrung. `lib/billing/currency.ts`
// entscheidet anhand des Besucherlandes, welche der beiden Preis-Ids ein
// Checkout bekommt; hier steht nur die Zuordnung selbst.

import Stripe from 'stripe'
import type { Tier } from './plans'

/** Die Stufen, die man tatsaechlich kaufen kann. */
export type PurchasableTier = 'STARTER' | 'PROFESSIONAL'

/** Die beiden Waehrungen, in denen ein Preis angelegt sein kann. */
export type PriceCurrency = 'EUR' | 'CHF'

const PURCHASABLE_TIERS: readonly PurchasableTier[] = ['STARTER', 'PROFESSIONAL']
const PRICE_CURRENCIES: readonly PriceCurrency[] = ['EUR', 'CHF']

/** Der Name der Umgebungsvariable fuer eine bestimmte Tarif-Waehrung-Kombination. */
function priceEnvKey(tier: PurchasableTier, currency: PriceCurrency): string {
  return `STRIPE_PRICE_${tier}_${currency}`
}

export function isPurchasableTier(tier: string): tier is PurchasableTier {
  return tier === 'STARTER' || tier === 'PROFESSIONAL'
}

let client: Stripe | null = null

/**
 * Der Stripe-Client, einmal gebaut.
 *
 * Wirft, statt still `undefined` an die Stripe-Bibliothek zu reichen: Die
 * wuerde ihrerseits werfen, aber mit einer Meldung ueber ihr eigenes Format,
 * nicht ueber die fehlende Umgebungsvariable.
 */
export function stripeClient(): Stripe {
  if (client) return client

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY fehlt — siehe .env.example.')
  }

  client = new Stripe(key)
  return client
}

/** Ob Stripe ueberhaupt eingerichtet ist. */
export function hasStripeCredentials(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Ob *diese* Stufe kaufbar ist — fuer die Preisseite, die sonst einen Knopf
 * zeigen wuerde, der nur mit einer Fehlermeldung endet.
 *
 * Bewusst je Stufe geprueft, nicht nur global ueber `hasStripeCredentials()`:
 * Wer im Stripe-Dashboard erst STARTER anlegt und PROFESSIONAL noch nicht,
 * soll bei STARTER den Kaufknopf sehen und bei PROFESSIONAL weiterhin den
 * Anfrage-Weg — nicht bei beiden denselben Knopf, von dem der eine beim
 * Klicken scheitert.
 *
 * Verlangt *beide* Waehrungen, nicht nur eine: Der Checkout waehlt die
 * Preis-Id erst zur Laufzeit anhand des Besucherlandes (siehe currency.ts).
 * Fehlte nur die EUR-Id, saehe ein deutscher Besucher denselben Kaufknopf
 * wie ein Schweizer, der dann beim Klick mit `notConfigured` scheitert.
 */
export function isTierPurchasable(tier: PurchasableTier): boolean {
  if (!hasStripeCredentials()) return false
  return PRICE_CURRENCIES.every((currency) => Boolean(process.env[priceEnvKey(tier, currency)]))
}

/**
 * Die Stripe-Preis-Id einer kaufbaren Stufe in einer bestimmten Waehrung.
 *
 * Wirft bei fehlender Konfiguration statt `undefined` an Stripe zu reichen —
 * Stripe wiese das mit "No such price" zurueck, eine Meldung, die niemand
 * ohne den Quelltext einer fehlenden Umgebungsvariable zuordnen wuerde.
 */
export function priceIdForTier(tier: PurchasableTier, currency: PriceCurrency): string {
  const key = priceEnvKey(tier, currency)
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} fehlt — siehe .env.example.`)
  }
  return value
}

/**
 * Die Umkehrung: aus einer Stripe-Preis-Id die Tarifstufe, ueber beide
 * Waehrungen hinweg.
 *
 * Rein und ohne Stripe-Zugriff, deshalb ohne Mock testbar — das ist die
 * Funktion, die der Webhook bei jedem Ereignis aufruft, und ein Vertipper in
 * einer der vier Umgebungsvariablen darf nicht erst beim ersten echten Kauf
 * auffallen.
 */
export function tierForPriceId(priceId: string): PurchasableTier | null {
  if (!priceId) return null
  for (const tier of PURCHASABLE_TIERS) {
    for (const currency of PRICE_CURRENCIES) {
      if (priceId === process.env[priceEnvKey(tier, currency)]) return tier
    }
  }
  return null
}

/**
 * Was ein Abo-Ereignis fuer den Tarif bedeutet — rein, kein Stripe-Zugriff.
 *
 * Ausgelagert aus dem Webhook, damit sich die eigentliche Entscheidung ohne
 * eine Stripe-Signatur und ohne Netzwerk testen laesst: Nur der Status
 * `active` oder `trialing` gewaehrt etwas, jeder andere (`past_due`,
 * `canceled`, `unpaid`, `incomplete_expired`, …) zieht den Tarif zurueck.
 * Ein unbekannter Preis (falsch konfiguriert oder ein Preis, den es nicht
 * mehr gibt) zieht ebenfalls zurueck statt zu raten.
 */
export function resolveSubscriptionOutcome(
  status: Stripe.Subscription.Status,
  priceId: string | null
): { tier: Tier } | { revoke: true } {
  const tier = priceId ? tierForPriceId(priceId) : null
  const grants = status === 'active' || status === 'trialing'

  if (grants && tier) return { tier }
  return { revoke: true }
}
