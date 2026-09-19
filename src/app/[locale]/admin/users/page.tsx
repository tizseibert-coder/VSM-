import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { hasAdminCredentials } from '@/lib/supabase/admin'
import { listUsers } from '@/lib/crm/queries'
import { buttonSecondarySm } from '@/components/ui/buttons'

const PER_PAGE = 50

/**
 * Die registrierten Nutzer.
 *
 * Die Liste kommt aus der Admin-API von Supabase, nicht aus einer Tabelle:
 * `auth.users` ist ueber PostgREST nicht lesbar. Organisation und Tarif je
 * Zeile kommen aus einer Sammelabfrage in `listUsers()`, nicht aus einer
 * Abfrage je Nutzer — bei 50 Zeilen pro Seite waere Letzteres 50 Rundreisen.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('Admin')
  const locale = await getLocale()

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const { users, hasMore } = await listUsers(page, PER_PAGE)
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  if (!hasAdminCredentials()) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('usersTitle')}</h1>
        <p className="mt-6 rounded-surface border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          {t('usersNotConfigured')}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('usersTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-600">{t('usersBody')}</p>

      {users.length === 0 ? (
        <p className="mt-8 rounded-surface border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          {t('usersEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colEmail')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colOrganization')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colRegistered')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colLastSignIn')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colConfirmed')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 text-zinc-950">
                    {user.email ?? user.id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-3">
                    {user.organizations.length === 0 ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {user.organizations.map((org, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-zinc-700">{org.name}</span>
                            <span className="rounded-control bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                              {org.tier}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-zinc-700">
                    {dtf.format(new Date(user.createdAt))}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-zinc-700">
                    {user.lastSignInAt ? dtf.format(new Date(user.lastSignInAt)) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {user.confirmed ? (
                      <span className="text-xs text-green-700">{t('confirmedYes')}</span>
                    ) : (
                      <span className="text-xs text-amber-700">{t('confirmedNo')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={page - 1 > 1 ? `/admin/users?page=${page - 1}` : '/admin/users'}
              className={buttonSecondarySm}
            >
              {t('pagePrev')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-600">{t('pageCurrent', { page })}</span>
          {hasMore ? (
            <Link href={`/admin/users?page=${page + 1}`} className={buttonSecondarySm}>
              {t('pageNext')}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
