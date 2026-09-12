// Der einzige Weg, ueber den diese Anwendung eine Mail verschickt.
//
// Alles hier ist bewusst allgemein gehalten — Betreff, HTML, Text, kein
// Wissen ueber Interessenten, Newsletter oder irgendeine andere fachliche
// Sache. Wer als naechstes eine Willkommensmail oder eine Einladung per Mail
// braucht (statt des bisherigen Kopierlinks, siehe team/actions.ts), ruft
// dieselbe Funktion mit einem eigenen Template auf, siehe lib/mail/templates/.
//
// Schlaegt nie durch einen Fehlwurf durch: Eine Mail, die nicht ankommt, darf
// den Vorgang, der sie ausgeloest hat, nicht abbrechen (dieselbe Linie wie
// recordLeadEvent in lib/crm/leads.ts). Wer das Ergebnis braucht, um selbst zu
// entscheiden, liest den Rueckgabewert.

import { hasMailCredentials, mailFrom, resendClient } from './resend'

export type SendMailInput = {
  to: string
  subject: string
  html: string
  /** Reiner Text als Rueckfall fuer Postfaecher, die HTML-Mails nicht
   *  anzeigen, und fuer Spamfilter, die eine reine HTML-Mail ohne
   *  Text-Gegenstueck abwerten. */
  text: string
  replyTo?: string
}

export type SendMailResult =
  | { ok: true }
  | { ok: false; error: 'not_configured' | 'failed' }

/**
 * Verschickt eine einzelne Mail.
 *
 * `not_configured` heisst: RESEND_API_KEY oder RESEND_FROM_EMAIL fehlt. Kein
 * Fehler in der Oberflaeche — derselbe Gedanke wie bei Stripe
 * (isTierPurchasable()): Eine Umgebung ohne Mail-Zugangsdaten soll den
 * Vorgang, der die Mail ausloest, trotzdem abschliessen, nur eben ohne Mail.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!hasMailCredentials()) return { ok: false, error: 'not_configured' }

  try {
    const resend = resendClient()
    const { error } = await resend.emails.send({
      from: mailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })

    if (error) {
      console.error('sendMail failed:', error.message)
      return { ok: false, error: 'failed' }
    }
    return { ok: true }
  } catch (err) {
    console.error('sendMail failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'failed' }
  }
}
