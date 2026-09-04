// Wer den Verwaltungsbereich sehen darf — die Betreiberseite, nicht die
// Rolle innerhalb einer Organisation.
//
// Die Absicherung ist die RLS auf `vsm_leads`/`vsm_lead_events`: Wer nicht in
// `vsm_staff` steht, bekommt dort leere Ergebnisse, egal was die Oberflaeche
// tut. Die Pruefungen hier sind die *Erklaerung* — und bei allem, was ueber
// den Service-Role-Client laeuft, zusaetzlich die einzige Kontrolle, weil der
// RLS umgeht.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type StaffRole = 'admin' | 'sales'

export type Staff = {
  userId: string
  email: string | null
  role: StaffRole
}

/**
 * Die eigene Betreiberrolle, oder null.
 *
 * Liest genau die eigene Zeile — die Policy „staff can read own row" laesst
 * das jedem Angemeldeten zu, damit die Navigation entscheiden kann, ob sie den
 * Verwaltungspunkt ueberhaupt anzeigt, ohne dafuer selbst Betreiber sein zu
 * muessen.
 */
export async function loadStaff(): Promise<Staff | null> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return null

  const { data, error } = await supabase
    .from('vsm_staff')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('loadStaff failed:', error.message)
    return null
  }
  if (!data) return null

  return {
    userId: data.user_id,
    email: (claimsData?.claims?.email as string | undefined) ?? null,
    role: data.role === 'admin' ? 'admin' : 'sales',
  }
}

/**
 * Wie `loadStaff`, aber bricht ab, statt null zu liefern.
 *
 * Nicht angemeldet → zur Anmeldung. Angemeldet, aber kein Betreiber → 404
 * statt 403: Wer nicht dazugehoert, soll nicht erfahren, dass es diesen
 * Bereich gibt. Ein „Kein Zugriff" waere die Bestaetigung, nach der jemand
 * sucht, der die Adresse geraten hat.
 */
export async function requireStaff(): Promise<Staff> {
  const staff = await loadStaff()
  if (staff) return staff

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login?next=/admin')

  notFound()
}

/** Zusaetzlich zur Betreiberrolle: nur `admin`. Das ist die Grenze fuer alles,
 *  was Geld kostet oder Rechte vergibt — vor allem die Tarifvergabe. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff()
  if (staff.role !== 'admin') notFound()
  return staff
}
