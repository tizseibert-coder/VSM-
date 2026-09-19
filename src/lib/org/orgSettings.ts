// Das Firmenprofil aus der Datenbank — Lesen und Schreiben.
//
// Die Tabelle `vsm_org_settings` gehoert Taktane und liegt neben
// `organizations`, nicht darin: Die gehoert Prisma / LeanPulse Industrial
// (supabase/README.md). Ohne Zeile gilt das leere Profil, und das ist der
// Zustand jeder bestehenden Firma — deshalb darf nichts hier von einer
// vorhandenen Zeile ausgehen.

import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { normalizeBrandColor, orgDisplayName } from './branding'

export type OrgSettingsRow = Tables<'vsm_org_settings'>

/**
 * Das Profil, wie die Oberflaeche es braucht: ohne das Logo.
 *
 * Das Bild bleibt bewusst draussen. Es haengt an fast jeder Seite mit (die
 * Kopfleiste zeigt es), und 200 KiB base64 in der Server-Antwort jeder Seite
 * waeren teurer als der Abruf ueber `/api/org-logo/...`, den der Browser
 * zwischenspeichert. Wer das Bild wirklich in der Hand braucht — die
 * Einladungsseite, die es einem Nichtangemeldeten zeigt, und der PDF-Export —
 * holt es ueber `loadOrgLogo()`.
 */
export type OrgProfile = {
  organizationId: string
  /** Der Name fuers Blatt: das eigene Feld, sonst der aus dem Login. */
  displayName: string
  /** Was im Feld steht — leer, solange nichts gesetzt wurde. Fuer das Formular. */
  displayNameRaw: string | null
  legalName: string | null
  industry: string | null
  website: string | null
  contactEmail: string | null
  contactPhone: string | null
  brandColor: string | null
  hasLogo: boolean
  /** Aendert sich mit jedem Austausch — haengt als Parameter an der Bildadresse,
   *  damit ein neues Logo nicht hinter dem alten im Zwischenspeicher bleibt. */
  logoVersion: string | null
  defaultCurrency: string | null
  defaultAvailableMinutes: number | null
  defaultLocale: string | null
  reportFooter: string | null
  /**
   * CAMA: Arbeitstage/Monat, ein Kalender fuer die ganze Firma (Index 0 =
   * Januar). `null` an einer Stelle heisst "fuer diesen Monat nichts
   * hinterlegt" — anders als resolveWorkdaysCalendar in capacityAnalysis.ts,
   * das dort schon den Vorgabewert einsetzt: hier soll das Formular sehen,
   * was wirklich gesetzt ist, und den Vorgabewert nur als Platzhalter zeigen.
   */
  capacityWorkdays: (number | null)[]
}

/** Das leere Profil — der Zustand ohne Zeile, und damit der Normalfall am Tag
 *  des Einspielens. */
export function emptyProfile(organizationId: string, organizationName: string): OrgProfile {
  return {
    organizationId,
    displayName: organizationName,
    displayNameRaw: null,
    legalName: null,
    industry: null,
    website: null,
    contactEmail: null,
    contactPhone: null,
    brandColor: null,
    hasLogo: false,
    logoVersion: null,
    defaultCurrency: null,
    defaultAvailableMinutes: null,
    defaultLocale: null,
    reportFooter: null,
    capacityWorkdays: Array(12).fill(null),
  }
}

/**
 * Liest vsm_org_settings.capacity_workdays (jsonb-Objekt {"1":21,...,"12":22},
 * ungeprueft — siehe Migration) in ein 12er-Array. Ungueltige oder fehlende
 * Monate werden zu `null`, nicht zu 0: 0 Arbeitstage waere eine Behauptung,
 * die niemand gemacht hat.
 */
function parseCapacityWorkdays(raw: unknown): (number | null)[] {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return Array.from({ length: 12 }, (_, index) => {
    const value = record[String(index + 1)]
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  })
}

/**
 * Das Profil einer Organisation.
 *
 * Ein Lesefehler ergibt das leere Profil und keinen geworfenen Fehler:
 * Branding ist Beiwerk. Wer wegen einer fehlenden Policy sein Dashboard nicht
 * mehr oeffnen kann, hat ein groesseres Problem als ein fehlendes Logo — und
 * genau dieser Fall (Anwendung eingespielt, Migration noch nicht) tritt
 * zwischen zwei Auslieferungen regelmaessig ein.
 */
export async function loadOrgProfile(
  organizationId: string,
  organizationName: string
): Promise<OrgProfile> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vsm_org_settings')
    .select(
      'organization_id, display_name, legal_name, industry, website, contact_email, contact_phone, brand_color, logo_mime, logo_updated_at, default_currency, default_available_minutes, default_locale, report_footer, capacity_workdays'
    )
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('loadOrgProfile failed:', error.message)
    return emptyProfile(organizationId, organizationName)
  }
  if (!data) return emptyProfile(organizationId, organizationName)

  return {
    organizationId,
    displayName: orgDisplayName(data.display_name, organizationName),
    displayNameRaw: data.display_name,
    legalName: data.legal_name,
    industry: data.industry,
    website: data.website,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    brandColor: normalizeBrandColor(data.brand_color),
    hasLogo: Boolean(data.logo_mime),
    logoVersion: data.logo_updated_at,
    defaultCurrency: data.default_currency,
    defaultAvailableMinutes:
      data.default_available_minutes === null ? null : Number(data.default_available_minutes),
    defaultLocale: data.default_locale,
    reportFooter: data.report_footer,
    capacityWorkdays: parseCapacityWorkdays(data.capacity_workdays),
  }
}

export type OrgLogo = { mime: string; base64: string }

/** Das Bild selbst. Getrennt, weil es der teure Teil ist — siehe OrgProfile. */
export async function loadOrgLogo(organizationId: string): Promise<OrgLogo | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vsm_org_settings')
    .select('logo_mime, logo_data')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('loadOrgLogo failed:', error.message)
    return null
  }
  if (!data?.logo_mime || !data.logo_data) return null
  return { mime: data.logo_mime, base64: data.logo_data }
}

/**
 * Die Vorgaben, mit denen ein neu angelegter Wertstrom startet.
 *
 * Ein Erprober merkt als erstes, ob er die Waehrung und die Firma bei jedem
 * Projekt wieder eintippen muss. Nur gesetzte Werte werden mitgegeben —
 * ansonsten gelten die Vorgaben der Tabelle `projects`, und die stehen dort,
 * wo sie hingehoeren.
 */
export async function projectDefaults(
  organizationId: string,
  organizationName: string
): Promise<{ company?: string; currency?: string; available_minutes_per_day?: number }> {
  const profile = await loadOrgProfile(organizationId, organizationName)
  const defaults: { company?: string; currency?: string; available_minutes_per_day?: number } = {}

  // `company` steht auf dem Blatt in der Kundenbox. Der Name aus dem Login
  // ("Max Muster's Organization") gehoert da nicht hin, der selbst gewaehlte
  // schon — deshalb nur das eigene Feld, nicht `displayName`.
  const company = profile.displayNameRaw?.trim() || profile.legalName?.trim()
  if (company) defaults.company = company
  if (profile.defaultCurrency) defaults.currency = profile.defaultCurrency
  if (profile.defaultAvailableMinutes !== null) {
    defaults.available_minutes_per_day = profile.defaultAvailableMinutes
  }

  return defaults
}
