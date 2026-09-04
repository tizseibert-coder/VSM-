// Die Abfragen des Verwaltungsbereichs.
//
// Zwei Wege, und die Unterscheidung ist nicht willkuerlich:
//
//   * Interessenten und ihre Chronik laufen ueber den *angemeldeten* Client.
//     Die Policies auf `vsm_leads`/`vsm_lead_events` lassen genau Betreiber
//     lesen — die Absicherung liegt damit in der Datenbank, wo sie hingehoert,
//     und ein Fehler in der Oberflaeche gibt trotzdem nichts heraus.
//   * Nutzer und Organisationen laufen ueber den Service-Role-Client, weil
//     `auth.users` ueber PostgREST nicht lesbar ist und `organizations` per
//     RLS nur die eigenen zeigt. Jede dieser Funktionen setzt voraus, dass die
//     aufrufende Seite vorher `requireStaff()` gerufen hat.

import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { LEAD_STAGES, type LeadStage } from './leads'

export type LeadRow = {
  id: string
  email: string
  full_name: string | null
  company: string | null
  job_title: string | null
  stage: string
  source: string
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
  last_activity_at: string
  owner_user_id: string | null
  user_id: string | null
}

export type LeadFilter = {
  stage?: string | null
  /** Freitext ueber Adresse, Name und Firma. */
  q?: string | null
  source?: string | null
  limit?: number
  offset?: number
}

const LIST_COLUMNS =
  'id, email, full_name, company, job_title, stage, source, utm_source, utm_campaign, created_at, last_activity_at, owner_user_id, user_id'

export const LEADS_PER_PAGE = 50

export async function listLeads(
  filter: LeadFilter = {}
): Promise<{ rows: LeadRow[]; total: number }> {
  const supabase = await createClient()
  const limit = filter.limit ?? LEADS_PER_PAGE
  const offset = filter.offset ?? 0

  let query = supabase
    .from('vsm_leads')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter.stage && isStage(filter.stage)) query = query.eq('stage', filter.stage)
  if (filter.source) query = query.eq('source', filter.source)

  if (filter.q) {
    // `or` erwartet die Bedingungen als eine Zeichenkette, in der Komma und
    // Klammer die Struktur bilden — ein Suchbegriff, der eines davon
    // enthaelt, wuerde die Bedingung zerlegen statt gesucht zu werden.
    const term = filter.q.replace(/[,()\\]/g, ' ').trim()
    if (term) {
      const pattern = `%${term}%`
      query = query.or(
        `email.ilike.${pattern},full_name.ilike.${pattern},company.ilike.${pattern}`
      )
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listLeads failed:', error.message)
    return { rows: [], total: 0 }
  }
  return { rows: (data ?? []) as LeadRow[], total: count ?? 0 }
}

export function isStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value)
}

export type LeadDetail = LeadRow & {
  phone: string | null
  message: string | null
  locale: string | null
  utm_medium: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  landing_path: string | null
  consent_at: string | null
  consent_text: string | null
  organization_id: string | null
  updated_at: string
}

export type LeadEventRow = {
  id: string
  kind: string
  body: string | null
  payload: unknown
  actor_user_id: string | null
  created_at: string
}

export async function getLead(
  leadId: string
): Promise<{ lead: LeadDetail; events: LeadEventRow[] } | null> {
  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('vsm_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (error) {
    console.error('getLead failed:', error.message)
    return null
  }
  if (!lead) return null

  const { data: events, error: eventsError } = await supabase
    .from('vsm_lead_events')
    .select('id, kind, body, payload, actor_user_id, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (eventsError) console.error('getLead (events) failed:', eventsError.message)

  return { lead: lead as LeadDetail, events: (events ?? []) as LeadEventRow[] }
}

export type LeadStats = {
  byStage: Record<LeadStage, number>
  total: number
  last7Days: number
  last30Days: number
}

/**
 * Die Zahlen der Uebersicht.
 *
 * Acht Zaehlabfragen statt einer Gruppierung: PostgREST kann `group by` nicht,
 * und eine Datenbankansicht dafuer waere ein Objekt mehr, das gepflegt werden
 * will. `head: true` laedt keine Zeilen, nur die Anzahl — bei acht Abfragen
 * ist das eine Rundreise, die man nicht merkt.
 */
export async function loadLeadStats(): Promise<LeadStats> {
  const supabase = await createClient()

  const base = () => supabase.from('vsm_leads').select('id', { count: 'exact', head: true })

  const count = async (query: ReturnType<typeof base>): Promise<number> => {
    const { count: value, error } = await query
    if (error) {
      console.error('loadLeadStats failed:', error.message)
      return 0
    }
    return value ?? 0
  }

  const since = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [stageCounts, total, last7Days, last30Days] = await Promise.all([
    Promise.all(LEAD_STAGES.map((stage) => count(base().eq('stage', stage)))),
    count(base()),
    count(base().gte('created_at', since(7))),
    count(base().gte('created_at', since(30))),
  ])

  const byStage = Object.fromEntries(
    LEAD_STAGES.map((stage, i) => [stage, stageCounts[i]])
  ) as Record<LeadStage, number>

  return { byStage, total, last7Days, last30Days }
}

export type AdminUser = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  confirmed: boolean
}

/**
 * Die registrierten Nutzer.
 *
 * Ueber die Admin-API, nicht ueber PostgREST: `auth.users` ist dort nicht
 * lesbar, und ein Spiegel in `public` braeuchte einen zweiten Trigger auf
 * einer Tabelle, die dem VSM Builder nicht gehoert (siehe
 * supabase/README.md).
 */
export async function listUsers(page = 1, perPage = 50): Promise<{
  users: AdminUser[]
  hasMore: boolean
}> {
  if (!hasAdminCredentials()) return { users: [], hasMore: false }

  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

  if (error) {
    console.error('listUsers failed:', error.message)
    return { users: [], hasMore: false }
  }

  return {
    users: data.users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      confirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
    })),
    hasMore: data.users.length === perPage,
  }
}

export type OrganizationRow = {
  id: string
  name: string
  slug: string
  createdAt: string
  memberCount: number
  projectCount: number
  tier: string
}

/**
 * Alle Organisationen mit Tarif, Mitgliedern und Projekten.
 *
 * Drei Abfragen und die Zaehlung im Speicher statt einer Abfrage je
 * Organisation: Bei 200 Organisationen waeren das sonst 600 Rundreisen. Die
 * Grenze ist bewusst gesetzt und nicht seitenweise ausgebaut — wenn sie
 * erreicht ist, braucht dieser Bereich ohnehin eine Suche statt einer Liste.
 */
export async function listOrganizations(limit = 200): Promise<OrganizationRow[]> {
  if (!hasAdminCredentials()) return []

  const supabase = createAdminClient()

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('listOrganizations failed:', error.message)
    return []
  }
  if (!orgs || orgs.length === 0) return []

  const ids = orgs.map((org) => org.id)

  const [members, projects, entitlements] = await Promise.all([
    supabase.from('organization_members').select('organization_id').in('organization_id', ids),
    supabase.from('projects').select('organization_id').in('organization_id', ids),
    supabase
      .from('organization_entitlements')
      .select('organization_id, tier, status, granted_at')
      .eq('product', 'VSM_BUILDER')
      .eq('status', 'ACTIVE')
      .in('organization_id', ids)
      .order('granted_at', { ascending: false, nullsFirst: false }),
  ])

  const tally = (rows: { organization_id: string }[] | null) => {
    const counts = new Map<string, number>()
    for (const row of rows ?? []) {
      counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1)
    }
    return counts
  }

  const memberCounts = tally(members.data)
  const projectCounts = tally(projects.data)
  const tiers = new Map<string, string>()
  for (const row of entitlements.data ?? []) {
    // Mehrere aktive Zeilen sollte es nicht geben; wenn doch, gewinnt die
    // zuletzt vergebene.
    if (!tiers.has(row.organization_id)) tiers.set(row.organization_id, row.tier)
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.created_at,
    memberCount: memberCounts.get(org.id) ?? 0,
    projectCount: projectCounts.get(org.id) ?? 0,
    tier: tiers.get(org.id) ?? 'FREE',
  }))
}
