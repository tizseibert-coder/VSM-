// Interessenten anlegen und fortschreiben.
//
// Alles hier laeuft ueber den Service-Role-Client (siehe
// lib/supabase/admin.ts) und umgeht damit RLS. Der Grund steht dort: Das
// Formular auf der Verkaufsseite wird von Nichtangemeldeten ausgefuellt, und
// die Alternative waere ein offenes Schreibrecht auf eine Tabelle mit
// personenbezogenen Daten.
//
// Die Kehrseite: Diese Datei darf **nie** aus einer Client-Komponente
// erreichbar sein. Sie wird ausschliesslich aus Server Actions aufgerufen.

import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import { attributionColumns, type Attribution } from './attribution'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'trial' | 'customer' | 'lost'

export const LEAD_STAGES: readonly LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'trial',
  'customer',
  'lost',
]

export type LeadEventKind =
  | 'form'
  | 'signup'
  | 'note'
  | 'stage_change'
  | 'owner_change'
  | 'project_created'
  | 'plan_change'
  | 'system'

/** Postgres meldet die Verletzung eines UNIQUE-Index so. */
const UNIQUE_VIOLATION = '23505'

/** Die Adresse ist der Schluessel. Der Index steht auf `lower(email)`, also
 *  muss auch geschrieben werden, was gesucht wird — sonst legt „Max@…" neben
 *  „max@…" einen zweiten Interessenten an, bis der Index es verhindert. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type CaptureLeadInput = {
  email: string
  fullName?: string | null
  company?: string | null
  jobTitle?: string | null
  phone?: string | null
  message?: string | null
  locale?: string | null
  /** Welches Formular, nicht welche Kampagne. */
  source?: string
  attribution?: Attribution | null
  consentText?: string | null
  userId?: string | null
  organizationId?: string | null
  /** Nur nach oben: siehe `advanceStage`. */
  stage?: LeadStage
}

export type CaptureLeadResult =
  | { ok: true; leadId: string; created: boolean }
  | { ok: false; error: 'not_configured' | 'invalid_email' | 'failed' }

/**
 * Legt einen Interessenten an oder schreibt einen vorhandenen fort.
 *
 * Eine Zeile je Person, nicht je Kontaktaufnahme: Wer das Formular zweimal
 * ausfuellt, ist nicht zwei Interessenten. Was beim zweiten Mal dazukommt
 * (eine Telefonnummer, die beim ersten Mal fehlte), wird ergaenzt; was schon
 * dasteht, bleibt stehen — der zweite, knappere Eintrag darf den ersten,
 * ausfuehrlicheren nicht ueberschreiben.
 *
 * Die Herkunft wird nur beim Anlegen gesetzt. Sie beschreibt die erste
 * Beruehrung; ein spaeterer Besuch ueber einen anderen Weg macht die Anzeige
 * nicht rueckwirkend wirkungslos.
 */
export async function captureLead(
  input: CaptureLeadInput,
  // Der zweite Anlauf nach einer Index-Kollision. Mehr als einer waere kein
  // Wettlauf mehr, sondern eine Schleife.
  isRetry = false
): Promise<CaptureLeadResult> {
  if (!hasAdminCredentials()) return { ok: false, error: 'not_configured' }

  const email = normalizeEmail(input.email)
  if (!isPlausibleEmail(email)) return { ok: false, error: 'invalid_email' }

  const supabase = createAdminClient()

  const { data: existing, error: readError } = await supabase
    .from('vsm_leads')
    .select('id, stage, full_name, company, job_title, phone, message, locale, user_id, organization_id')
    .eq('email', email)
    .maybeSingle()

  if (readError) {
    console.error('captureLead (read) failed:', readError.message)
    return { ok: false, error: 'failed' }
  }

  if (existing) {
    const patch = fillGaps(existing, input)
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('vsm_leads')
        .update({ ...patch, last_activity_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) {
        console.error('captureLead (update) failed:', error.message)
        return { ok: false, error: 'failed' }
      }
    }
    return { ok: true, leadId: existing.id, created: false }
  }

  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('vsm_leads')
    .insert({
      email,
      full_name: blankToNull(input.fullName),
      company: blankToNull(input.company),
      job_title: blankToNull(input.jobTitle),
      phone: blankToNull(input.phone),
      message: blankToNull(input.message),
      locale: blankToNull(input.locale),
      stage: input.stage ?? 'new',
      source: input.source ?? 'website',
      consent_at: input.consentText ? now : null,
      consent_text: blankToNull(input.consentText),
      user_id: input.userId ?? null,
      organization_id: input.organizationId ?? null,
      last_activity_at: now,
      ...attributionColumns(input.attribution ?? null),
    })
    .select('id')
    .single()

  if (error) {
    // Zwei Formulare im selben Augenblick: Der Index hat gewonnen, die Zeile
    // ist also inzwischen da. Kein Fehlerfall — nur ein zweiter Anlauf als
    // Fortschreibung.
    if (error.code === UNIQUE_VIOLATION && !isRetry) {
      return captureLead({ ...input, email }, true)
    }
    console.error('captureLead (insert) failed:', error.message)
    return { ok: false, error: 'failed' }
  }

  return { ok: true, leadId: created.id, created: true }
}

/** Nur Felder, die beim Bestand leer sind. Der knappe zweite Eintrag darf den
 *  ausfuehrlichen ersten nicht ueberschreiben. */
function fillGaps(
  existing: {
    full_name: string | null
    company: string | null
    job_title: string | null
    phone: string | null
    message: string | null
    locale: string | null
    user_id: string | null
    organization_id: string | null
  },
  input: CaptureLeadInput
): Record<string, string | null> {
  const patch: Record<string, string | null> = {}
  const maybe = (column: string, current: string | null, next: string | null | undefined) => {
    const value = blankToNull(next)
    if (!current && value) patch[column] = value
  }

  maybe('full_name', existing.full_name, input.fullName)
  maybe('company', existing.company, input.company)
  maybe('job_title', existing.job_title, input.jobTitle)
  maybe('phone', existing.phone, input.phone)
  maybe('message', existing.message, input.message)
  maybe('locale', existing.locale, input.locale)
  maybe('user_id', existing.user_id, input.userId)
  maybe('organization_id', existing.organization_id, input.organizationId)

  return patch
}

/**
 * Hebt die Stufe an, senkt sie aber nie.
 *
 * Aus einem Kunden wird kein neuer Interessent, nur weil er das
 * Kontaktformular noch einmal benutzt. Zurueckstufen kann der Vertrieb von
 * Hand — das ist eine Entscheidung, kein Nebeneffekt.
 */
export async function advanceStage(leadId: string, stage: LeadStage): Promise<void> {
  if (!hasAdminCredentials()) return

  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('vsm_leads')
    .select('stage')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) return
  if (stageRank(lead.stage) >= stageRank(stage)) return

  const { error } = await supabase
    .from('vsm_leads')
    .update({ stage, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) console.error('advanceStage failed:', error.message)
}

/** 'lost' steht bewusst ganz unten und nicht ausserhalb der Ordnung: Ein
 *  verlorener Interessent, der sich spaeter doch registriert, soll wieder
 *  hochwandern duerfen. */
const STAGE_RANK: Record<string, number> = {
  lost: -1,
  new: 0,
  contacted: 1,
  qualified: 2,
  trial: 3,
  customer: 4,
}

export function stageRank(stage: string | null | undefined): number {
  return STAGE_RANK[stage ?? ''] ?? 0
}

export type LeadEventInput = {
  leadId: string
  kind: LeadEventKind
  body?: string | null
  payload?: Record<string, unknown> | null
  actorUserId?: string | null
}

/** Ein Eintrag in der Chronik. Fehler werden protokolliert, nicht geworfen:
 *  Eine fehlgeschlagene Chronikzeile darf keine Registrierung abbrechen. */
export async function recordLeadEvent(event: LeadEventInput): Promise<void> {
  if (!hasAdminCredentials()) return

  const supabase = createAdminClient()
  const { error } = await supabase.from('vsm_lead_events').insert({
    lead_id: event.leadId,
    kind: event.kind,
    body: blankToNull(event.body),
    payload: (event.payload ?? null) as Json,
    actor_user_id: event.actorUserId ?? null,
  })

  if (error) console.error('recordLeadEvent failed:', error.message)

  const { error: touchError } = await supabase
    .from('vsm_leads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', event.leadId)

  if (touchError) console.error('recordLeadEvent (touch) failed:', touchError.message)
}

/**
 * Haengt ein Ereignis an den Interessenten, der zu einem Nutzer gehoert.
 *
 * Ohne Treffer passiert nichts: Wer sich vor Einfuehrung der Vertriebsschicht
 * registriert hat, hat keinen Eintrag, und das nachtraeglich anzulegen waere
 * eine erfundene Vorgeschichte.
 */
export async function noteUserActivity(
  userId: string,
  kind: LeadEventKind,
  payload?: Record<string, unknown>
): Promise<void> {
  if (!hasAdminCredentials()) return

  const supabase = createAdminClient()
  const { data: lead, error } = await supabase
    .from('vsm_leads')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('noteUserActivity failed:', error.message)
    return
  }
  if (!lead) return

  await recordLeadEvent({ leadId: lead.id, kind, payload: payload ?? null })
}

/**
 * Absichtlich grob.
 *
 * Die Pruefung soll Tippfehler und leere Felder abfangen, nicht entscheiden,
 * welche Adresse es gibt — das entscheidet der Bestaetigungslink von Supabase.
 * Eine strengere Regel wirft regelmaessig gueltige Adressen weg (Umlaute in
 * der Domain, neue Endungen) und ist damit teurer als der Fehler, den sie
 * verhindert.
 */
export function isPlausibleEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.') && !/\s/.test(email)
}

function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
