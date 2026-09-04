import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireStaff } from '@/lib/crm/staff'

/**
 * Der Verwaltungsbereich — die Betreiberseite.
 *
 * `requireStaff()` steht im Layout und nicht in jeder Seite: Ein vergessener
 * Aufruf in einer spaeter hinzugefuegten Unterseite waere sonst ein offenes
 * Tor. Die eigentliche Absicherung bleibt die RLS auf `vsm_leads` — wer nicht
 * in `vsm_staff` steht, bekaeme auch ohne diese Zeile nur leere Listen.
 *
 * Der Aufruf laeuft *vor* jeder Unterseite, weil Next Layouts von aussen nach
 * innen rendert.
 */
/**
 * Zweite Reihe, nicht die erste: Wirksam ausgesperrt wird `/admin` in
 * app/robots.ts. Ein Roboter, der sich daran haelt, laedt diese Seite gar
 * nicht erst und sieht die Angabe hier nie — sie greift genau dann, wenn die
 * Regel dort einmal verlorengeht. Kostet nichts und ist die billigere Haelfte
 * einer Absicherung, bei der die teure Haelfte RLS heisst.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  const t = await getTranslations('Admin')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-brand-600">
              {t('title')}
            </span>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <Link href="/admin" className="text-zinc-700 hover:text-brand-600">
                {t('navOverview')}
              </Link>
              <Link href="/admin/leads" className="text-zinc-700 hover:text-brand-600">
                {t('navLeads')}
              </Link>
              <Link href="/admin/users" className="text-zinc-700 hover:text-brand-600">
                {t('navUsers')}
              </Link>
              <Link href="/admin/organizations" className="text-zinc-700 hover:text-brand-600">
                {t('navOrganizations')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{staff.email ?? staff.userId.slice(0, 8)}</span>
            <span className="rounded-control bg-zinc-100 px-2 py-0.5 font-medium uppercase tracking-wide">
              {staff.role === 'admin' ? t('roleAdmin') : t('roleSales')}
            </span>
            <Link href="/dashboard" className="hover:text-brand-600">
              {t('backToApp')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
