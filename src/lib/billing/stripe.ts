// Der Stripe-Client und die Zuordnung zwischen Tarif und Stripe-Preis.
//
// Nur STARTER und PROFESSIONAL sind selbstbedient — FREE braucht keine
// Zahlung, ENTERPRISE bleibt „Preis auf Anfrage" (siehe pricing/page.tsx).
// Die beiden Umgebungsvariablen tragen die Stripe-Preis-Ids, nicht die
// Betraege: Die Betraege stehen weiterhin in lib/billing/plans.ts und auf
// stripe.com, an zwei Stellen, aber nur eine davon ist die Abrechnung.

import Stripe from 'stripe'
import type { Tier } from './plans'

/** Die Stufen, die man tatsaechlich kaufen kann. */
export type PurchasableTier = 'STARTER' | 'PROFESSIONAL'

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
 */
export function isTierPurchasable(tier: PurchasableTier): boolean {
  if (!hasStripeCredentials()) return false
  const key = tier === 'STARTER' ? 'STRIPE_PRICE_STARTER' : 'STRIPE_PRICE_PROFESSIONAL'
  return Boolean(process.env[key])
}

/**
 * Die Stripe-Preis-Id einer kaufbaren Stufe.
 *
 * Wirft bei fehlender Konfiguration statt `undefined` an Stripe zu reichen —
 * Stripe wiese das mit "No such price" zurueck, eine Meldung, die niemand
 * ohne den Quelltext einer fehlenden Umgebungsvariable zuordnen wuerde.
 */
export function priceIdForTier(tier: PurchasableTier): string {
  const key = tier === 'STARTER' ? 'STRIPE_PRICE_STARTER' : 'STRIPE_PRICE_PROFESSIONAL'
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} fehlt — siehe .env.example.`)
  }
  return value
}

/**
 * Die Umkehrung: aus einer Stripe-Preis-Id die Tarifstufe.
 *
 * Rein und ohne Stripe-Zugriff, deshalb ohne Mock testbar — das ist die
 * Funktion, die der Webhook bei jedem Ereignis aufruft, und ein Vertipper in
 * einer der beiden Umgebungsvariablen darf nicht erst beim ersten echten
 * Kauf auffallen.
 */
export function tierForPriceId(priceId: string): PurchasableTier | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return 'STARTER'
  if (priceId && priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return 'PROFESSIONAL'
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
