import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LEADS_PER_PAGE, listLeads } from '@/lib/crm/queries'
import { LEAD_STAGES } from '@/lib/crm/leads'
import { buttonPrimary, buttonSecondarySm, inputMd } from '@/components/ui/buttons'

/**
 * Die Interessentenliste.
 *
 * Filter und Suche stehen in der Adresse, nicht im Zustand einer
 * Client-Komponente: Eine gefilterte Liste ist damit teilbar ("schau dir die
 * offenen aus der LinkedIn-Kampagne an") und ueberlebt das Neuladen. Dafuer
 * genuegt ein gewoehnliches GET-Formular ohne eine Zeile JavaScript.
 */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('Admin')
  const locale = await getLocale()

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const { rows, total } = await listLeads({
    stage: params.stage ?? null,
    q: params.q ?? null,
    offset: (page - 1) * LEADS_PER_PAGE,
  })

  const lastPage = Math.max(1, Math.ceil(total / LEADS_PER_PAGE))
  const df = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  const pageHref = (target: number) => {
    const query = new URLSearchParams()
    if (params.stage) query.set('stage', params.stage)
    if (params.q) query.set('q', params.q)
    if (target > 1) query.set('page', String(target))
    const suffix = query.toString()
    return suffix ? `/admin/leads?${suffix}` : '/admin/leads'
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('leadsTitle')}</h1>
        <p className="text-sm text-zinc-600">{t('leadsCount', { count: total })}</p>
      </div>

      {/* GET, damit der Filter in der Adresse landet. Ein Formular mit
          `action` auf dieselbe Seite braucht dafuer weder Action noch
          Client-Komponente. */}
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('filterSearch')}</span>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder={t('filterSearchPlaceholder')}
            className={`${inputMd} w-64`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('filterStage')}</span>
          <select name="stage" defaultValue={params.stage ?? ''} className={inputMd}>
            <option value="">{t('filterStageAll')}</option>
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {t(`stage_${stage}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonPrimary}>
          {t('filterApply')}
        </button>
        {(params.q || params.stage) && (
          <Link href="/admin/leads" className={buttonSecondarySm}>
            {t('filterReset')}
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-surface border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          {t('leadsEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colContact')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colCompany')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colStage')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colSource')}</th>
                <th className="px-5 py-3 font-medium text-zinc-600">{t('colActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-medium text-zinc-950 hover:text-brand-600 hover:underline"
                    >
                      {lead.full_name || lead.email}
                    </Link>
                    {lead.full_name && (
                      <div className="text-xs text-zinc-500">{lead.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-700">
                    {lead.company ?? '—'}
                    {lead.job_title && (
                      <div className="text-xs text-zinc-500">{lead.job_title}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-control bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {t(`stage_${lead.stage}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-600">
                    {lead.utm_source ?? lead.source}
                    {lead.utm_campaign && <div className="text-zinc-500">{lead.utm_campaign}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs tabular-nums text-zinc-600">
                    {df.format(new Date(lead.last_activity_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonSecondarySm}>
              {t('pagePrev')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-600">{t('pageOf', { page, lastPage })}</span>
          {page < lastPage ? (
            <Link href={pageHref(page + 1)} className={buttonSecondarySm}>
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
