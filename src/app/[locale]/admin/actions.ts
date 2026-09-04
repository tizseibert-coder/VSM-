'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { requireAdmin, requireStaff } from '@/lib/crm/staff'
import { isStage } from '@/lib/crm/queries'
import { isTier } from '@/lib/billing/plans'

/**
 * Setzt die Trichterstufe eines Interessenten.
 *
 * Schreibt ueber den *angemeldeten* Client: Die Policy „staff can write leads"
 * laesst genau das zu, und damit prueft die Datenbank mit, was die Oberflaeche
 * behauptet. Der Service-Role-Client kaeme hier ohne Not zum Einsatz.
 *
 * Anders als `advanceStage` (die beim Registrieren nur hochstuft) darf hier
 * auch zurueckgestuft werden — das ist eine Entscheidung des Vertriebs, kein
 * Nebeneffekt eines Klicks des Kunden.
 */
export async function setLeadStage(leadId: string, formData: FormData) {
  const staff = await requireStaff()
  const stage = formData.get('stage')

  if (typeof stage !== 'string' || !isStage(stage)) {
    redirect(`/admin/leads/${leadId}?error=stage`)
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('vsm_leads')
    .select('stage')
    .eq('id', leadId)
    .maybeSingle()

  if (before?.stage === stage) redirect(`/admin/leads/${leadId}`)

  const { error } = await supabase
    .from('vsm_leads')
    .update({ stage, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    console.error('setLeadStage failed:', error.message)
    redirect(`/admin/leads/${leadId}?error=save`)
  }

  // Die Chronik traegt den Wechsel *mit Vorher-Wert*. Ein Protokoll, in dem
  // nur der neue Zustand steht, beantwortet die Frage nicht, die man spaeter
  // stellt ("wann ist der aus der Erprobung gefallen?").
  await supabase.from('vsm_lead_events').insert({
    lead_id: leadId,
    kind: 'stage_change',
    body: `${before?.stage ?? '?'} → ${stage}`,
    actor_user_id: staff.userId,
  })

  revalidatePath(`/admin/leads/${leadId}`)
  revalidatePath('/admin/leads')
  redirect(`/admin/leads/${leadId}`)
}

/** Eine Handnotiz an der Chronik. Anfuegend, nicht aenderbar — wer sich
 *  vertippt hat, schreibt eine Berichtigung darunter. */
export async function addLeadNote(leadId: string, formData: FormData) {
  const staff = await requireStaff()
  const body = (formData.get('body') as string | null)?.trim()

  if (!body) redirect(`/admin/leads/${leadId}`)

  const supabase = await createClient()
  const { error } = await supabase.from('vsm_lead_events').insert({
    lead_id: leadId,
    kind: 'note',
    body,
    actor_user_id: staff.userId,
  })

  if (error) {
    console.error('addLeadNote failed:', error.message)
    redirect(`/admin/leads/${leadId}?error=save`)
  }

  await supabase
    .from('vsm_leads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', leadId)

  revalidatePath(`/admin/leads/${leadId}`)
  redirect(`/admin/leads/${leadId}`)
}

/** Zustaendigkeit uebernehmen oder abgeben. Zwei Zustaende genuegen: „ich" und
 *  „niemand". Eine Auswahlliste aller Betreiber braeuchte deren Namen, und die
 *  stehen nicht in einer Tabelle, die die Oberflaeche lesen kann. */
export async function claimLead(leadId: string, release: boolean) {
  const staff = await requireStaff()

  const supabase = await createClient()
  const { error } = await supabase
    .from('vsm_leads')
    .update({ owner_user_id: release ? null : staff.userId })
    .eq('id', leadId)

  if (error) {
    console.error('claimLead failed:', error.message)
    redirect(`/admin/leads/${leadId}?error=save`)
  }

  await supabase.from('vsm_lead_events').insert({
    lead_id: leadId,
    kind: 'owner_change',
    body: release ? null : staff.email,
    actor_user_id: staff.userId,
  })

  revalidatePath(`/admin/leads/${leadId}`)
  redirect(`/admin/leads/${leadId}`)
}

/**
 * Vergibt einem Haus einen Tarif.
 *
 * `organization_entitlements` gehoert Prisma/LeanPulse Industrial (siehe
 * supabase/README.md). Der VSM Builder legt dort *Zeilen* an, keine Objekte —
 * das ist gewoehnliche Nutzung, keine Eigentumsverletzung. Ueber den
 * Service-Role-Client, weil unbekannt ist, welche Policies dort haengen und
 * ob sie sich morgen aendern: Ein Tarifwechsel, der stillschweigend an einer
 * fremden Policy scheitert, waere schlimmer als gar keiner.
 *
 * Nur `admin`, nicht `sales`: Das hier kostet Geld.
 */
export async function grantTier(organizationId: string, formData: FormData) {
  const staff = await requireAdmin()
  const tier = formData.get('tier')

  if (typeof tier !== 'string' || !isTier(tier)) {
    redirect('/admin/organizations?error=tier')
  }
  if (!hasAdminCredentials()) {
    redirect('/admin/organizations?error=notConfigured')
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Erst die bisherige Vergabe zurueckziehen, dann die neue eintragen. Ein
  // `update` auf der vorhandenen Zeile waere kuerzer, wuerde aber die
  // Geschichte ueberschreiben — und die Frage "seit wann ist das Haus auf
  // PROFESSIONAL?" ist genau die, die spaeter gestellt wird.
  const { error: revokeError } = await supabase
    .from('organization_entitlements')
    .update({ status: 'REVOKED' })
    .eq('organization_id', organizationId)
    .eq('product', 'VSM_BUILDER')
    .eq('status', 'ACTIVE')

  if (revokeError) {
    console.error('grantTier (revoke) failed:', revokeError.message)
    redirect('/admin/organizations?error=save')
  }

  const { error } = await supabase.from('organization_entitlements').insert({
    organization_id: organizationId,
    product: 'VSM_BUILDER',
    tier,
    status: 'ACTIVE',
    granted_at: now,
  })

  if (error) {
    console.error('grantTier failed:', error.message)
    redirect('/admin/organizations?error=save')
  }

  // Wenn zu diesem Haus ein Interessent gehoert, bekommt seine Chronik den
  // Tarifwechsel. Ohne Treffer passiert nichts.
  const { data: lead } = await supabase
    .from('vsm_leads')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (lead) {
    await supabase.from('vsm_lead_events').insert({
      lead_id: lead.id,
      kind: 'plan_change',
      body: tier,
      actor_user_id: staff.userId,
    })
  }

  revalidatePath('/admin/organizations')
  redirect('/admin/organizations')
}
