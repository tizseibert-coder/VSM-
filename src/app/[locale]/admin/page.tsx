import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { hasAdminCredentials } from '@/lib/supabase/admin'
import { loadLeadStats } from '@/lib/crm/queries'
import { LEAD_STAGES } from '@/lib/crm/leads'
import { planEnforcementActive } from '@/lib/billing/entitlement'

/**
 * Die Uebersicht: der Trichter in Zahlen.
 *
 * Bewusst ohne Diagramm. Sechs Stufen mit je einer Zahl liest man in einer
 * Sekunde; ein Balkendiagramm derselben sechs Zahlen braucht laenger und sagt
 * nichts dazu. Diagramme lohnen hier erst, wenn ein Verlauf ueber die Zeit
 * dahintersteht — und der braucht mehr Historie, als diese Tabellen haben.
 */
export default async function AdminOverviewPage() {
  const t = await getTranslations('Admin')
  const locale = await getLocale()
  const stats = await loadLeadStats()
  const configured = hasAdminCredentials()

  const nf = new Intl.NumberFormat(locale)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('overviewTitle')}</h1>
      <p className="mt-1 text-sm text-zinc-600">{t('overviewBody')}</p>

      {/* Die beiden Betriebsschalter. Sie stehen hier und nicht in einer
          Dokumentationsdatei, weil die Frage "warum passiert nichts?" genau
          hier gestellt wird. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-surface border px-5 py-4 ${
            configured ? 'border-zinc-200 bg-white' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            {t('captureStatus')}
          </p>
          <p className="mt-1 text-sm text-zinc-800">
            {configured ? t('captureOn') : t('captureOff')}
          </p>
        </div>
        <div className="rounded-surface border border-zinc-200 bg-white px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            {t('enforcementStatus')}
          </p>
          <p className="mt-1 text-sm text-zinc-800">
            {planEnforcementActive() ? t('enforcementOn') : t('enforcementOff')}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid gap-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        {[
          { label: t('statTotal'), value: stats.total },
          { label: t('statLast7'), value: stats.last7Days },
          { label: t('statLast30'), value: stats.last30Days },
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-5 py-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">
              {stat.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
              {nf.format(stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-base font-semibold text-zinc-950">{t('funnelTitle')}</h2>
      <ul className="mt-3 divide-y divide-zinc-200 rounded-surface border border-zinc-200 bg-white">
        {LEAD_STAGES.map((stage) => (
          <li key={stage}>
            <Link
              href={`/admin/leads?stage=${stage}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50"
            >
              <span className="text-sm text-zinc-800">{t(`stage_${stage}`)}</span>
              <span className="text-sm font-medium tabular-nums text-zinc-950">
                {nf.format(stats.byStage[stage])}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
