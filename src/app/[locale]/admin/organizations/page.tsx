import { getLocale, getTranslations } from 'next-intl/server'
import { hasAdminCredentials } from '@/lib/supabase/admin'
import { listOrganizations } from '@/lib/crm/queries'
import { loadStaff } from '@/lib/crm/staff'
import { PUBLIC_TIERS, TIERS, limitsFor } from '@/lib/billing/plans'
import { planEnforcementActive } from '@/lib/billing/entitlement'
import { grantTier } from '../actions'
import { buttonPrimarySm, inputSm } from '@/components/ui/buttons'

/**
 * Die Haeuser mit ihrem Tarif.
 *
 * Die Tarifvergabe schreibt in `organization_entitlements` — eine Tabelle der
 * gemeinsamen Datenbank, die Prisma gehoert (siehe supabase/README.md). Wir
 * legen dort Zeilen an, keine Objekte; das ist gewoehnliche Nutzung. Vergeben
 * darf nur `admin`, nicht `sales`: Das hier kostet Geld.
 */
export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('Admin')
  const locale = await getLocale()
  const staff = await loadStaff()
  const canGrant = staff?.role === 'admin'

  if (!hasAdminCredentials()) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('orgsTitle')}</h1>
        <p className="mt-6 rounded-surface border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          {t('usersNotConfigured')}
        </p>
      </div>
    )
  }

  const orgs = await listOrganizations()
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('orgsTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {planEnforcementActive() ? t('orgsBodyEnforced') : t('orgsBodyObserving')}
      </p>

      {error && (
        <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(error === 'notConfigured' ? 'usersNotConfigured' : 'errorSave')}
        </p>
      )}

      {orgs.length === 0 ? (
        <p className="mt-8 rounded-surface border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          {t('orgsEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colOrganization')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colTier')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colProjects')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colMembers')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colCreated')}</th>
                {canGrant && <th className="px-5 py-3 font-medium text-zinc-600">{t('colGrant')}</th>}
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const limits = limitsFor(org.tier)
                // Rot, wenn das Haus ueber seiner Grenze liegt. Das ist der
                // Normalfall, solange die Durchsetzung aus ist — und genau die
                // Liste, die man vor dem Anschalten durchgeht.
                const overProjects =
                  limits.maxProjects !== null && org.projectCount > limits.maxProjects
                const overMembers =
                  limits.maxMembers !== null && org.memberCount > limits.maxMembers

                return (
                  <tr key={org.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-zinc-950">{org.name}</div>
                      <div className="text-xs text-zinc-500">{org.slug}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-control bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                        {org.tier}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 tabular-nums ${overProjects ? 'text-red-700' : 'text-zinc-700'}`}
                    >
                      {org.projectCount}
                      <span className="text-zinc-400">
                        {' / '}
                        {limits.maxProjects ?? '∞'}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 tabular-nums ${overMembers ? 'text-red-700' : 'text-zinc-700'}`}
                    >
                      {org.memberCount}
                      <span className="text-zinc-400">
                        {' / '}
                        {limits.maxMembers ?? '∞'}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-zinc-700">
                      {dtf.format(new Date(org.createdAt))}
                    </td>
                    {canGrant && (
                      <td className="px-5 py-3">
                        <form
                          action={grantTier.bind(null, org.id)}
                          className="flex items-center gap-2"
                        >
                          <select name="tier" defaultValue={org.tier} className={inputSm}>
                            {TIERS.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                                {PUBLIC_TIERS.includes(tier) ? '' : ' *'}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={buttonPrimarySm}>
                            {t('grantSave')}
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canGrant && <p className="mt-3 text-xs text-zinc-500">{t('grantBetaNote')}</p>}
      {!canGrant && <p className="mt-3 text-xs text-zinc-500">{t('grantAdminOnly')}</p>}
    </div>
  )
}
