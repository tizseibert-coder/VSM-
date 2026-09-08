// Welche Waehrung eine Besucherin sieht und tatsaechlich bezahlt.
//
// Ausserhalb der Schweiz Euro, in der Schweiz Franken — nicht umgerechnet,
// sondern derselbe Zahlenwert (12, 49) in der jeweils anderen Einheit, weil
// der Betrieb in beiden Waehrungen einen eigenen Stripe-Preis fuehrt (siehe
// billing/stripe.ts). Diese Datei entscheidet nur, welche der beiden gilt —
// fuer die Anzeige auf der Preisseite genauso wie fuer die Preis-Id, die
// startCheckout() tatsaechlich an Stripe schickt. Beide muessen densselben
// Weg gehen: Zeigt die Seite Euro, aber der Checkout rechnet in Franken ab,
// ist das kein Rundungsfehler, sondern ein falscher Preis im Kaufmoment.

import { headers } from 'next/headers'
import type { Tier } from './plans'
import { MONTHLY_AMOUNT } from './plans'
import type { PriceCurrency } from './stripe'

export type { PriceCurrency }

/**
 * Land -> Waehrung. Rein, deshalb ohne die Vercel-Kopfzeile testbar.
 *
 * Nur "CH" fuehrt zu Franken; jedes andere Land (Deutschland, Oesterreich,
 * aber auch jedes nicht erkannte) faellt auf Euro zurueck. Das ist bewusst
 * die gaengigere Vorgabe, nicht ein Fehlerfall: Die Kopfzeile fehlt lokal
 * und in jeder Umgebung ausserhalb Vercels vollstaendig.
 */
export function currencyForCountry(country: string | null | undefined): PriceCurrency {
  return country === 'CH' ? 'CHF' : 'EUR'
}

/**
 * Die Waehrung der aktuellen Anfrage, aus Vercels Geo-Kopfzeile
 * `x-vercel-ip-country`. Die Kopfzeile setzt ausschliesslich Vercels
 * Edge-Netz — lokal und bei jedem anderen Hoster bleibt sie leer, und
 * `currencyForCountry(null)` liefert dann Euro, dieselbe Vorgabe wie fuer
 * jedes Land ausserhalb der Schweiz.
 */
export async function visitorCurrency(): Promise<PriceCurrency> {
  const country = (await headers()).get('x-vercel-ip-country')
  return currencyForCountry(country)
}

/**
 * Ein Betrag als Geldwert formatiert — ohne Nachkommastellen, weil in dieser
 * Anwendung nur runde Zahlen vorkommen (0, 12, 49).
 */
export function formatAmount(amount: number, currency: PriceCurrency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Der `{price}`-Platzhalter fuer die Uebersetzung `Pricing.tier*Price`.
 *
 * FREE bekommt 0, STARTER/PROFESSIONAL ihren Betrag aus `MONTHLY_AMOUNT`,
 * ENTERPRISE eine leere Zeichenkette — deren Uebersetzung ("Preis auf
 * Anfrage") traegt gar keinen Platzhalter, ein ungenutzter Parameter stoert
 * next-intl dabei nicht.
 */
export function tierPriceParams(
  tier: Tier,
  currency: PriceCurrency,
  locale: string
): { price: string } {
  const amount =
    tier === 'FREE' ? 0 : tier === 'STARTER' || tier === 'PROFESSIONAL' ? MONTHLY_AMOUNT[tier] : null

  return { price: amount === null ? '' : formatAmount(amount, currency, locale) }
}
