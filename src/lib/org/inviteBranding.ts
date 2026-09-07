// Was der Empfaenger eines Einladungslinks sieht, bevor er angemeldet ist.
//
// Die Einladungsseite ist die erste Seite, die ein Beta-Tester ueberhaupt zu
// sehen bekommt — vor der Registrierung, vor dem Dashboard. Sie zeigte bis
// hierher „Sie wurden eingeladen, einem Team beizutreten" und nannte weder
// die Firma noch den Absender. Fuer eine Einladung, die als persoenliche
// Kontaktaufnahme gemeint war, ist das die falsche Seite.
//
// ─────────────────────────────────────────────────────────────────────
// Warum das hier mit dem Service-Role-Schluessel liest
// ─────────────────────────────────────────────────────────────────────
// Der Empfaenger ist `anon`. Eine Policy, die `anon` auf
// `vsm_invite_settings` lesen liesse, muesste `USING (true)` lauten — der
// Token steht ja nicht im JWT, sondern in der Adresse. Damit haette jeder mit
// dem publishable key die Liste aller Einladungen aller Firmen, also die
// Aufstellung, wer wen anspricht. Das ist bei einer Erprobung genau die
// Information, die niemanden etwas angeht.
//
// Also serverseitig, gezielt ueber den Hash des Tokens, den nur der
// Empfaenger hat, und mit einer Rueckgabe, die ausschliesslich Anzeigeangaben
// enthaelt: kein Token, keine Rolle, keine Id. Dieselbe Linie wie bei den
// Interessenten (src/lib/supabase/admin.ts) — die Umgehung ist eng gefasst
// und die Kontrolle steht davor, hier in Form des Tokens selbst.

import { createHash } from 'node:crypto'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { logoDataUrl, normalizeBrandColor } from './branding'

export type InviteBranding = {
  /** Der Name, unter dem die einladende Firma auftreten will. */
  organizationName: string
  /** Persoenliche Anrede des Absenders, oder null. */
  welcomeMessage: string | null
  /** Fuer wen der Link gedacht war — steht in der Anrede, nicht als Formularwert. */
  inviteeName: string | null
  brandColor: string | null
  /** Als `data:`-Adresse, weil der Empfaenger keine geschuetzte Bildadresse
   *  abrufen koennte. Ein Logo ist klein genug, um in dieser einen Seite
   *  mitzureisen. */
  logoDataUrl: string | null
}

/** Derselbe Hash, den `createInvite` in beide Tabellen schreibt. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Die Anzeigeangaben zu einem Einladungslink, oder null.
 *
 * Null heisst nicht „ungueltiger Token": Ob die Einladung gilt, entscheidet
 * `accept_invitation` beim Einloesen und niemand sonst — hier zu pruefen
 * hiesse, dieselbe Frage an zwei Stellen zu beantworten. Null heisst nur:
 * keine eigenen Angaben hinterlegt (oder kein Service-Role-Schluessel
 * konfiguriert). Dann zeigt die Seite denselben Text wie bisher, und das ist
 * ein vollstaendig brauchbarer Zustand.
 */
export async function loadInviteBranding(token: string): Promise<InviteBranding | null> {
  if (!hasAdminCredentials()) return null

  const tokenHash = hashInviteToken(token)
  const admin = createAdminClient()

  const { data: invite, error } = await admin
    .from('vsm_invite_settings')
    .select('organization_id, invitee_name, welcome_message, show_branding')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('loadInviteBranding (invite) failed:', error.message)
    return null
  }
  if (!invite) return null

  // Wer beim Erstellen „ohne Logo" gewaehlt hat, bekommt die neutrale Seite:
  // ein Berater, der drei Haeuser betreut, will nicht das Logo des einen auf
  // der Einladung des anderen.
  if (!invite.show_branding) {
    return {
      organizationName: '',
      welcomeMessage: invite.welcome_message,
      inviteeName: invite.invitee_name,
      brandColor: null,
      logoDataUrl: null,
    }
  }

  const [{ data: org }, { data: settings }] = await Promise.all([
    admin.from('organizations').select('name').eq('id', invite.organization_id).maybeSingle(),
    admin
      .from('vsm_org_settings')
      .select('display_name, brand_color, logo_mime, logo_data')
      .eq('organization_id', invite.organization_id)
      .maybeSingle(),
  ])

  const chosen = settings?.display_name?.trim()

  return {
    organizationName: chosen && chosen.length > 0 ? chosen : (org?.name ?? ''),
    welcomeMessage: invite.welcome_message,
    inviteeName: invite.invitee_name,
    brandColor: normalizeBrandColor(settings?.brand_color),
    logoDataUrl: logoDataUrl(settings?.logo_mime ?? null, settings?.logo_data ?? null),
  }
}
