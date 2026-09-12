// Newsletter-Doppel-Opt-in: Token erzeugen, Mail auslösen, Bestätigung
// entgegennehmen.
//
// Dieselbe Bauart wie ein Einladungslink (team/actions.ts,
// lib/org/inviteBranding.ts): Der rohe Token steht nur im Mail-Link, in der
// Datenbank liegt ausschliesslich sein sha256-Hash. Eine Kopie der
// Datenbank — ein Backup, ein Dump fuer die Fehlersuche — gibt damit
// niemandem die Moeglichkeit, fremde Newsletter-Anmeldungen zu bestaetigen.
//
// Wie in lib/crm/leads.ts: Service-Role durchgehend, weil sowohl das
// Ankreuzen (nicht angemeldet, Verkaufsseite) als auch das Bestaetigen
// (Klick aus der Mail, ebenfalls nicht angemeldet) ausserhalb jeder Sitzung
// passieren.

import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { localizedUrl } from '@/lib/seo/site'
import { sendMail } from '@/lib/mail/send'
import { newsletterConfirmMail } from '@/lib/mail/templates/newsletterConfirm'
import { recordLeadEvent } from './leads'

/** Sieben Tage — grosszuegig genug fuer eine Mail, die im Spamordner landet
 *  und erst spaeter gefunden wird, knapp genug, dass ein alter, ungenutzter
 *  Link nicht unbegrenzt gueltig bleibt. */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Rein, ohne Datenbankzugriff — deshalb ohne Mock testbar. `null` (kein
 *  Token gesetzt) zaehlt als abgelaufen: Es gibt dann nichts zu bestaetigen. */
export function isExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() < now
}

export type RequestNewsletterResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'mail_not_configured' | 'mail_failed' | 'failed' }

/**
 * Setzt einen neuen Bestaetigungstoken auf den Interessenten und verschickt
 * die Mail dazu.
 *
 * Bricht die Erfassung des Interessenten selbst nie ab — der Aufrufer
 * (lead-actions.ts) protokolliert ein `not_ok`-Ergebnis, verwirft es aber:
 * Wer das Formular ausgefuellt hat, soll seinen Eintrag behalten, auch wenn
 * gerade kein RESEND_API_KEY gesetzt ist.
 */
export async function requestNewsletterConfirmation(input: {
  leadId: string
  email: string
  locale: string
  consentText: string
}): Promise<RequestNewsletterResult> {
  if (!hasAdminCredentials()) return { ok: false, reason: 'not_configured' }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  const admin = createAdminClient()
  const { error } = await admin
    .from('vsm_leads')
    .update({
      newsletter_consent_text: input.consentText,
      newsletter_requested_at: new Date().toISOString(),
      newsletter_confirm_token_hash: tokenHash,
      newsletter_confirm_token_expires_at: expiresAt,
    })
    .eq('id', input.leadId)

  if (error) {
    console.error('requestNewsletterConfirmation (update) failed:', error.message)
    return { ok: false, reason: 'failed' }
  }

  const confirmUrl = `${localizedUrl(input.locale, '/newsletter/confirm')}?token=${encodeURIComponent(token)}`
  const mail = await newsletterConfirmMail(input.locale, confirmUrl)
  const sent = await sendMail({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  })

  if (!sent.ok) {
    return { ok: false, reason: sent.error === 'not_configured' ? 'mail_not_configured' : 'mail_failed' }
  }

  return { ok: true }
}

export type ConfirmNewsletterOutcome =
  | 'confirmed'
  | 'already'
  | 'invalid'
  | 'expired'
  | 'not_configured'

/**
 * Wertet einen Bestaetigungslink aus.
 *
 * Der Token wird nach Gebrauch geloescht (Hash und Ablaufdatum auf null) —
 * ein Link, der nach der Bestaetigung noch existiert, waere ein zweiter
 * gueltiger Weg zu demselben Zustand, ohne einen Nutzen, der das
 * rechtfertigt.
 */
export async function confirmNewsletter(token: string): Promise<ConfirmNewsletterOutcome> {
  if (!hasAdminCredentials()) return 'not_configured'
  if (!token) return 'invalid'

  const tokenHash = hashToken(token)
  const admin = createAdminClient()

  const { data: lead, error } = await admin
    .from('vsm_leads')
    .select('id, newsletter_confirmed_at, newsletter_confirm_token_expires_at')
    .eq('newsletter_confirm_token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('confirmNewsletter (read) failed:', error.message)
    return 'invalid'
  }
  if (!lead) return 'invalid'
  if (lead.newsletter_confirmed_at) return 'already'
  if (isExpired(lead.newsletter_confirm_token_expires_at)) return 'expired'

  const { error: updateError } = await admin
    .from('vsm_leads')
    .update({
      newsletter_confirmed_at: new Date().toISOString(),
      newsletter_confirm_token_hash: null,
      newsletter_confirm_token_expires_at: null,
    })
    .eq('id', lead.id)

  if (updateError) {
    console.error('confirmNewsletter (update) failed:', updateError.message)
    return 'invalid'
  }

  await recordLeadEvent({ leadId: lead.id, kind: 'newsletter_confirmed' })

  return 'confirmed'
}
