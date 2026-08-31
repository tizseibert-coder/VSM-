// Server-Zugriff auf die Mitgliedschaften des angemeldeten Nutzers und die
// daraus gewaehlte aktive Organisation. Die Auswahlregel selbst liegt in
// pickActiveOrg.ts und ist dort getestet.

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { pickActiveOrg, type Membership } from './pickActiveOrg'

/** Zuletzt gewaehlte Organisation. Nur Benutzerfuehrung — die Absicherung ist RLS. */
export const ACTIVE_ORG_COOKIE = 'vsm_active_org'

/**
 * Alle Organisationen des Nutzers.
 *
 * Bewusst zwei Abfragen statt eines PostgREST-Embeds: der eingebettete Join
 * liefert je nach Version ein Objekt oder ein Array zurueck, und diese
 * Unterscheidung im Typsystem sauber zu halten kostet mehr als die zweite
 * Abfrage. Es geht hier um eine Handvoll Zeilen pro Nutzer.
 */
export async function loadMemberships(): Promise<Membership[]> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return []

  const { data: rows, error } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', userId)

  if (error) {
    console.error('loadMemberships (members) failed:', error.message)
    return []
  }
  if (!rows || rows.length === 0) return []

  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .in(
      'id',
      rows.map((r) => r.organization_id)
    )

  if (orgError) {
    console.error('loadMemberships (organizations) failed:', orgError.message)
    return []
  }

  const nameById = new Map((orgs ?? []).map((o) => [o.id, o.name]))

  return rows
    // Eine Mitgliedschaft ohne lesbare Organisation waere ein Widerspruch zur
    // organizations-Policy. Sie wegzulassen ist ehrlicher, als sie mit einem
    // Platzhalternamen anzuzeigen.
    .filter((r) => nameById.has(r.organization_id))
    .map((r) => ({
      organizationId: r.organization_id,
      organizationName: nameById.get(r.organization_id) as string,
      role: r.role,
    }))
}

/**
 * Die aktive Organisation plus alle verfuegbaren — letztere braucht das
 * Dashboard fuer den Umschalter, sobald jemand in mehreren ist.
 */
export async function getActiveOrg(): Promise<
  { active: Membership; all: Membership[] } | { error: string }
> {
  const all = await loadMemberships()
  const store = await cookies()
  const active = pickActiveOrg(all, store.get(ACTIVE_ORG_COOKIE)?.value ?? null)

  if (!active) return { error: 'Keine Organisation gefunden.' }
  return { active, all }
}
