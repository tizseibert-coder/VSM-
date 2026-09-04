import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getLead } from '@/lib/crm/queries'
import { LEAD_STAGES } from '@/lib/crm/leads'
import { requireStaff } from '@/lib/crm/staff'
import { addLeadNote, claimLead, setLeadStage } from '../../actions'
import { buttonPrimary, buttonSecondarySm, inputMd } from '@/components/ui/buttons'

/**
 * Ein Interessent mit seiner Chronik.
 *
 * Die Chronik mischt Systemereignisse (Registrierung, erstes Projekt) und
 * Handnotizen bewusst in einer Liste: Der Vertrieb will eine Zeitleiste lesen,
 * keine zwei nebeneinander, zwischen denen er die Reihenfolge selbst
 * herstellen muss.
 */
export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { leadId } = await params
  const { error } = await searchParams
  const t = await getTranslations('Admin')
  const locale = await getLocale()
  const staff = await requireStaff()

  const result = await getLead(leadId)
  if (!result) notFound()

  const { lead, events } = result
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const isMine = lead.owner_user_id === staff.userId

  // Nur Felder mit Inhalt. Eine Tabelle voller Striche sagt dasselbe wie eine
  // kuerzere ohne sie, kostet aber den Blick, der sie ueberfliegt.
  const facts: { label: string; value: string }[] = [
    { label: t('fieldEmail'), value: lead.email },
    { label: t('fieldName'), value: lead.full_name ?? '' },
    { label: t('fieldCompany'), value: lead.company ?? '' },
    { label: t('fieldRole'), value: lead.job_title ?? '' },
    { label: t('fieldPhone'), value: lead.phone ?? '' },
    { label: t('fieldLocale'), value: lead.locale ?? '' },
    { label: t('fieldSource'), value: lead.source },
    { label: t('fieldUtmSource'), value: lead.utm_source ?? '' },
    { label: t('fieldUtmMedium'), value: lead.utm_medium ?? '' },
    { label: t('fieldUtmCampaign'), value: lead.utm_campaign ?? '' },
    { label: t('fieldReferrer'), value: lead.referrer ?? '' },
    { label: t('fieldLandingPath'), value: lead.landing_path ?? '' },
    { label: t('fieldCreated'), value: dtf.format(new Date(lead.created_at)) },
    {
      label: t('fieldConsent'),
      value: lead.consent_at ? dtf.format(new Date(lead.consent_at)) : '',
    },
  ].filter((fact) => fact.value !== '')

  return (
    <div>
      <Link href="/admin/leads" className="text-xs text-zinc-500 hover:underline">
        {t('backToLeads')}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
        {lead.full_name || lead.email}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        {lead.company ? `${lead.company} · ` : ''}
        {lead.email}
      </p>

      {error && (
        <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(error === 'stage' ? 'errorStage' : 'errorSave')}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-surface border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">{t('stageHeading')}</h2>
            <form action={setLeadStage.bind(null, lead.id)} className="mt-3 flex gap-2">
              <select name="stage" defaultValue={lead.stage} className={`${inputMd} flex-1`}>
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {t(`stage_${stage}`)}
                  </option>
                ))}
              </select>
              <button type="submit" className={buttonPrimary}>
                {t('stageSave')}
              </button>
            </form>

            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="text-xs text-zinc-600">
                {lead.owner_user_id
                  ? isMine
                    ? t('ownerMine')
                    : t('ownerOther', { owner: lead.owner_user_id.slice(0, 8) })
                  : t('ownerNone')}
              </p>
              <form action={claimLead.bind(null, lead.id, isMine)} className="mt-2">
                <button type="submit" className={buttonSecondarySm}>
                  {isMine ? t('ownerRelease') : t('ownerClaim')}
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-surface border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">{t('factsHeading')}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                  <dt className="text-xs text-zinc-500">{fact.label}</dt>
                  <dd className="break-words text-zinc-800">{fact.value}</dd>
                </div>
              ))}
            </dl>
            {lead.consent_text && (
              <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
                {lead.consent_text}
              </p>
            )}
          </section>
        </div>

        <div>
          <section className="rounded-surface border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">{t('noteHeading')}</h2>
            <form action={addLeadNote.bind(null, lead.id)} className="mt-3">
              <textarea
                name="body"
                rows={3}
                required
                placeholder={t('notePlaceholder')}
                className="w-full rounded-control border border-zinc-300 px-3 py-2 text-sm"
              />
              <button type="submit" className={`${buttonPrimary} mt-2`}>
                {t('noteSave')}
              </button>
            </form>
          </section>

          <h2 className="mt-8 text-sm font-semibold text-zinc-950">{t('timelineHeading')}</h2>
          {events.length === 0 ? (
            <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
              {t('timelineEmpty')}
            </p>
          ) : (
            <ol className="mt-3 space-y-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200">
              {events.map((event) => (
                <li key={event.id} className="bg-white px-5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-brand-700">
                      {t(`event_${event.kind}`)}
                    </span>
                    <time
                      dateTime={event.created_at}
                      className="text-xs tabular-nums text-zinc-500"
                    >
                      {dtf.format(new Date(event.created_at))}
                    </time>
                  </div>
                  {event.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                      {event.body}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
