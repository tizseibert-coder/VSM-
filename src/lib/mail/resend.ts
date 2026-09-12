// Der Resend-Client und die Absenderadresse.
//
// Dieselbe Bauart wie lib/billing/stripe.ts: ein einzelner, verzoegert
// gebauter Client, eine Funktion, die prueft, ob er ueberhaupt eingerichtet
// ist, und ein Fehler, der die fehlende Umgebungsvariable nennt statt die
// Bibliothek ueber `undefined` stolpern zu lassen.
//
// Resend statt eines eigenen SMTP-Servers: Kein Betrieb eines Mailservers,
// keine SPF/DKIM/DMARC-Einrichtung von Hand, und eine API, die von einer
// Server Action aus genauso aufgerufen wird wie stripe.checkout.sessions.create
// — kein zusaetzliches Protokoll im Code.

import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Der Resend-Client, einmal gebaut.
 *
 * Wirft, statt still `undefined` an die Bibliothek zu reichen: Die wuerde
 * ihrerseits werfen, aber mit einer Meldung ueber ihr eigenes Format, nicht
 * ueber die fehlende Umgebungsvariable.
 */
export function resendClient(): Resend {
  if (client) return client

  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY fehlt — siehe .env.example.')
  }

  client = new Resend(key)
  return client
}

/** Ob Mailversand ueberhaupt eingerichtet ist. */
export function hasMailCredentials(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

/**
 * Die Absenderadresse, mit Anzeigenamen.
 *
 * `RESEND_FROM_EMAIL` muss in Resend als verifizierte Domain hinterlegt
 * sein — eine unverifizierte Absenderadresse liefert Resend gar nicht erst
 * aus. `RESEND_FROM_NAME` ist optional; ohne ihn steht nur die Adresse da.
 */
export function mailFrom(): string {
  const address = process.env.RESEND_FROM_EMAIL
  if (!address) {
    throw new Error('RESEND_FROM_EMAIL fehlt — siehe .env.example.')
  }
  const name = process.env.RESEND_FROM_NAME?.trim()
  return name ? `${name} <${address}>` : address
}
