'use server'

import { getTranslations } from 'next-intl/server'
import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { loadPlan } from '@/lib/billing/entitlement'
import { quota } from '@/lib/billing/plans'

/** Gueltigkeitsdauer einer Einladung. Kurz genug, dass ein vergessener Link nicht ewig offen steht. */
const INVITE_DAYS = 7

export type CreateInviteResult = { ok: true; url: string } | { ok: false; error: string } | null

/**
 * Legt eine Einladung an und gibt den fertigen Link *einmalig* zurueck.
 *
 * Der rohe Token wird bewusst nicht in der Datenbank abgelegt (dort steht nur
 * sein sha256-Hash) und auch nicht ueber einen Redirect-Parameter
 * zurueckgereicht — er wuerde sonst in der Browser-Historie und in den
 * Server-Logs des Redirects landen. Stattdessen kommt er als Rueckgabewert der
 * Action direkt in die Oberflaeche, wo er kopiert werden kann. Danach ist er
 * nicht mehr rekonstruierbar; wer ihn verliert, zieht die Einladung zurueck und
 * legt eine neue an.
 */
export async function createInvite(
  _prev: CreateInviteResult,
  formData: FormData
): Promise<CreateInviteResult> {
  const role = formData.get('role')
  if (role !== 'editor' && role !== 'viewer') {
    return { ok: false, error: await tErr('inviteRoleInvalid') }
  }

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) return { ok: false, error: orgResult.error }

  // Die Policy laesst nur Inhaber schreiben; die Pruefung hier dient der
  // Erklaerung, nicht der Absicherung.
  if (orgResult.active.role !== 'owner') {
    return { ok: false, error: 'Nur Inhaber können Mitglieder einladen.' }
  }

  // Sitzplaetze des Tarifs. Gezaehlt werden Mitglieder *und* offene
  // Einladungen: Wer fuenf Plaetze hat, drei besetzt und zwei Einladungen
  // offen, darf keine dritte verschicken — sonst waere die Grenze erst in dem
  // Moment ueberschritten, in dem der Eingeladene sie annimmt, und die
  // Absage traefe den Falschen.
  const seatError = await seatLimitError(orgResult.active.organizationId)
  if (seatError) return { ok: false, error: seatError }

  // 32 Byte aus der Krypto-Quelle, base64url — nicht erratbar und ohne
  // Sonderzeichen, die beim Kopieren durch Chat-Programme kaputtgehen.
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  const { error } = await supabase.from('organization_invitations').insert({
    organization_id: orgResult.active.organizationId,
    role,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: claims?.claims?.sub ?? null,
  })

  if (error) {
    console.error('createInvite failed:', error.message)
    return { ok: false, error: await tErr('inviteCreate') }
  }

  const headerList = await headers()
  const host = headerList.get('host')
  const origin =
    headerList.get('origin') ??
    (host ? `https://${host}` : null) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  revalidatePath('/team')
  return { ok: true, url: `${origin}/invite/${token}` }
}

/**
 * Zieht eine Einladung zurueck. Sie wird nicht geloescht, sondern als
 * zurueckgezogen markiert — wer spaeter fragt, warum ein Link nicht
 * funktioniert, soll die Antwort in der Liste finden.
 */
export async function revokeInvite(invitationId: string) {
  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirect('/team?error=' + encodeURIComponent(orgResult.error))
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('organization_id', orgResult.active.organizationId)
    .is('revoked_at', null)
    .is('accepted_at', null)

  if (error) {
    console.error('revokeInvite failed:', error.message)
    redirect('/team?error=' + encodeURIComponent(await tErr('inviteRevoke')))
  }

  revalidatePath('/team')
  redirect('/team')
}

/** Die Sitzplatzgrenze des Tarifs als fertige Meldung, oder null. */
async function seatLimitError(organizationId: string): Promise<string | null> {
  const plan = await loadPlan(organizationId)
  if (!plan.enforced) return null

  const supabase = await createClient()
  const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('organization_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])

  const seats = quota((memberCount ?? 0) + (inviteCount ?? 0), plan.limits.maxMembers)
  if (seats.allowed) return null

  const t = await getTranslations('Errors')
  return t('planMemberLimit', { limit: seats.limit ?? 0, tier: plan.tier })
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
