import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadPlan, loadPlanUsage } from '@/lib/billing/entitlement'
import { loadStaff } from '@/lib/crm/staff'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { DEFAULT_WORKDAYS_PER_MONTH } from '@/lib/vsm/capacityAnalysis'
import { computeCamaLine } from '@/components/VSMEditor/camaLine'
import OrgHeaderBar from '@/components/dashboard/OrgHeaderBar'
import type { Membership } from '@/lib/org/pickActiveOrg'
import type { Tables } from '@/types/database'

/**
 * Die Firmenübersicht — /dashboard für eine komplexe Organisation (mehr als
 * ein Modul in Benutzung, siehe hasMultipleModulesInUse in
 * lib/org/companyOverview.ts und docs/plan-company-overview-modules.md).
 * Eine Kachel je Modul statt der bisherigen, VSM-zentrierten Projektliste —
 * die lebt für die einfache Organisation unveraendert unter /projects, und
 * ist von hier aus genau eine Kachel unter mehreren, nicht mehr die ganze
 * Seite.
 *
 * `activeOrg`/`allOrgs` kommen als Props von dashboard/page.tsx, das sie für
 * die Komplexitätsentscheidung ohnehin schon geladen hat — keine zweite
 * Mitgliedschaftsabfrage für dieselbe Information.
 */
export default async function CompanyOverview({
  activeOrg,
  allOrgs,
  searchParams,
}: {
  activeOrg: Membership
  allOrgs: Membership[]
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('Dashboard')
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email ?? null

  const staff = await loadStaff()
  const profile = await loadOrgProfile(activeOrg.organizationId, activeOrg.organizationName)

  const plan = await loadPlan(activeOrg.organizationId)
  const usage = plan ? await loadPlanUsage(activeOrg.organizationId, plan) : null

  const { data: lines } = await supabase
    .from('production_lines')
    .select('id')
    .eq('organization_id', activeOrg.organizationId)
  const lineIds = (lines ?? []).map((l) => l.id)

  const { data: capacities } =
    lineIds.length > 0
      ? await supabase.from('line_capacity').select('*').in('line_id', lineIds)
      : { data: [] as Tables<'line_capacity'>[] }

  const workdaysByMonth = profile.capacityWorkdays.map((value) => value ?? DEFAULT_WORKDAYS_PER_MONTH)
  const criticalLines = (capacities ?? []).filter((c) => {
    const result = computeCamaLine(c, workdaysByMonth)
    return result?.color === 'orange' || result?.color === 'red'
  }).length

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <OrgHeaderBar activeOrg={activeOrg} allOrgs={allOrgs} profile={profile} staff={staff} email={email} />

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/projects"
            className="rounded-surface border border-zinc-200 bg-white p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <h2 className="text-base font-semibold text-zinc-950">{t('vsmTileTitle')}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {plan && usage
                ? usage.projects.limit === null
                  ? t('planUsageUnlimited', { used: usage.projects.used })
                  : t('planUsage', { used: usage.projects.used, limit: usage.projects.limit })
                : t('vsmTileEmpty')}
            </p>
            <p className="mt-4 text-sm font-medium text-brand-600">{t('vsmTileOpen')}</p>
          </Link>

          <Link
            href="/capacity"
            className="rounded-surface border border-zinc-200 bg-white p-6 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <h2 className="text-base font-semibold text-zinc-950">{t('capacityTileTitle')}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {lineIds.length === 0
                ? t('capacityTileEmpty')
                : criticalLines > 0
                  ? t('capacityTileCritical', { count: lineIds.length, critical: criticalLines })
                  : t('capacityTileOk', { count: lineIds.length })}
            </p>
            <p className="mt-4 text-sm font-medium text-brand-600">{t('capacityTileOpen')}</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
