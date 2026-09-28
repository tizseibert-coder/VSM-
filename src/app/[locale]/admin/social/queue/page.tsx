import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { buttonPrimarySm, buttonSecondarySm, buttonDangerSm, inputSm } from '@/components/ui/buttons'
import { FORMATS, TOPICS, formatNeedsCard, isChannel } from '@/lib/social/config'
import { channelConfigured, channelHasMetrics } from '@/lib/social/publishers'
import { latestSnapshot, visibility } from '@/lib/social/scoring'
import { daysAgo } from '@/lib/social/runner'
import { SocialHeader } from '../SocialHeader'
import {
  addManualMetrics,
  markPublished,
  publishNow,
  saveDraft,
  setPostStatus,
} from '../actions'

/**
 * Die Warteschlange: was freigegeben werden will, was zum Posten bereit
 * steht, und was veroeffentlicht ist und noch Messwerte braucht.
 *
 * `maxDuration`, weil "Jetzt posten" auf Instagram auf die Bildverarbeitung
 * wartet — Server Actions erben die Grenze von der Seite.
 */
export const maxDuration = 300

type SearchParams = Promise<{ notice?: string; error?: string; msg?: string }>

export default async function SocialQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error, msg } = await searchParams
  const t = await getTranslations('Social')
  const locale = await getLocale()
  const df = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const nf = new Intl.NumberFormat(locale)

  const supabase = await createClient()
  const since = daysAgo(45).toISOString()

  const [{ data: open }, { data: published }] = await Promise.all([
    supabase
      .from('vsm_social_posts')
      .select('*')
      .in('status', ['draft', 'approved', 'publishing', 'failed'])
      .order('scheduled_for')
      .order('channel'),
    supabase
      .from('vsm_social_posts')
      .select('*, vsm_social_metrics(age_hours, impressions, reach, reactions, comments, shares, saves, clicks, source)')
      .eq('status', 'published')
      .gte('published_at', since)
      .order('published_at', { ascending: false }),
  ])

  const review = (open ?? []).filter((p) => p.status !== 'approved')
  const approved = (open ?? []).filter((p) => p.status === 'approved')

  const topicLabel = (id: string) => TOPICS.find((x) => x.id === id)?.label ?? id
  const formatLabel = (channel: string, id: string) =>
    isChannel(channel) ? (FORMATS[channel].find((f) => f.id === id)?.label ?? id) : id
  const day = (iso: string) => df.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))

  type Post = NonNullable<typeof open>[number]

  const meta = (post: Post) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-brand-700">{t(`channel_${post.channel}`)}</span>
      <span className="text-zinc-800">{day(post.scheduled_for)}</span>
      <span className="text-zinc-500">{topicLabel(post.topic)}</span>
      <span className="rounded-control bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{post.format}</span>
      <span className="rounded-control bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{t('hook')}: {post.hook}</span>
      {post.explore && (
        <span className="rounded-control bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">{t('explore')}</span>
      )}
      {!channelConfigured(isChannel(post.channel) ? post.channel : 'linkedin') && (
        <span className="rounded-control border border-zinc-300 px-1.5 py-0.5 text-zinc-600">{t('manualMode')}</span>
      )}
    </div>
  )

  const cardPreview = (post: Post) =>
    isChannel(post.channel) && formatNeedsCard(post.channel, post.format) && post.card_headline ? (
      <a href={`/api/social/card/${post.id}`} target="_blank" rel="noreferrer" className="block shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- eigene, dynamisch erzeugte Kachel; next/image braeuchte dafuer eine Freigabe ohne Nutzen */}
        <img
          src={`/api/social/card/${post.id}?v=${encodeURIComponent(post.updated_at)}`}
          alt={post.card_headline}
          width={216}
          height={270}
          className="rounded-control border border-zinc-200"
        />
      </a>
    ) : null

  const editForm = (post: Post) => (
    <form action={saveDraft.bind(null, post.id)} className="mt-3 space-y-2">
      <textarea
        name="body"
        defaultValue={post.body}
        rows={Math.min(18, Math.max(6, post.body.split('\n').length + 2))}
        className="w-full rounded-control border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
      />
      <p className="text-xs text-zinc-500">{t('chars', { count: post.body.length })}</p>
      {isChannel(post.channel) && formatNeedsCard(post.channel, post.format) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-600">
            {t('cardHeadline')}
            <input name="card_headline" defaultValue={post.card_headline ?? ''} maxLength={90} className={`${inputSm} mt-1 w-full`} />
          </label>
          <label className="text-xs text-zinc-600">
            {t('cardSubline')}
            <input name="card_subline" defaultValue={post.card_subline ?? ''} maxLength={160} className={`${inputSm} mt-1 w-full`} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-600">
          {t('scheduledFor')}
          <input type="date" name="scheduled_for" defaultValue={post.scheduled_for} className={`${inputSm} mt-1 block`} />
        </label>
        <SubmitButton className={buttonSecondarySm}>{t('save')}</SubmitButton>
      </div>
    </form>
  )

  const manualPublishForm = (post: Post) => (
    <form action={markPublished.bind(null, post.id)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
      <label className="text-xs text-zinc-600">
        {t('postUrl')}
        <input name="external_url" type="url" placeholder="https://…" className={`${inputSm} mt-1 block w-72`} />
      </label>
      <label className="text-xs text-zinc-600">
        {t('publishedOn')}
        <input type="date" name="published_on" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputSm} mt-1 block`} />
      </label>
      <SubmitButton className={buttonSecondarySm}>{t('markPublished')}</SubmitButton>
    </form>
  )

  return (
    <div>
      <SocialHeader active="queue" notice={notice} error={error} msg={msg} />

      {/* ── Zur Freigabe ── */}
      <h2 className="mt-8 text-base font-semibold text-zinc-950">
        {t('reviewHeading')} <span className="font-normal text-zinc-500">({review.length})</span>
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t('reviewBody')}</p>
      {review.length === 0 ? (
        <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          {t('reviewEmpty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {review.map((post) => (
            <li key={post.id} className="rounded-surface border border-zinc-200 bg-white p-5">
              {meta(post)}
              <p className="mt-2 text-xs italic text-zinc-500">
                {formatLabel(post.channel, post.format)}
                {post.rationale ? ` — ${post.rationale}` : ''}
              </p>
              {post.status === 'failed' && post.last_error && (
                <p className="mt-2 break-words rounded-control bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
                  {post.last_error}
                </p>
              )}
              {post.status === 'publishing' && (
                <p className="mt-2 rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('stuckPublishing')}</p>
              )}
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="min-w-0 flex-1">{editForm(post)}</div>
                {cardPreview(post)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                {post.status !== 'publishing' && (
                  <form action={setPostStatus.bind(null, post.id, 'approve')}>
                    <SubmitButton className={buttonPrimarySm}>{t('approve')}</SubmitButton>
                  </form>
                )}
                {post.status === 'publishing' ? (
                  <form action={setPostStatus.bind(null, post.id, 'reopen')}>
                    <SubmitButton className={buttonSecondarySm}>{t('reopen')}</SubmitButton>
                  </form>
                ) : (
                  <form action={setPostStatus.bind(null, post.id, 'reject')}>
                    <SubmitButton className={buttonDangerSm}>{t('reject')}</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Freigegeben ── */}
      <h2 className="mt-10 text-base font-semibold text-zinc-950">
        {t('approvedHeading')} <span className="font-normal text-zinc-500">({approved.length})</span>
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t('approvedBody')}</p>
      {approved.length === 0 ? (
        <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          {t('approvedEmpty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {approved.map((post) => {
            const auto = isChannel(post.channel) && channelConfigured(post.channel)
            return (
              <li key={post.id} className="rounded-surface border border-zinc-200 bg-white p-5">
                {meta(post)}
                <div className="mt-3 flex flex-col gap-4 md:flex-row">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-800">
                    {post.body}
                  </pre>
                  {cardPreview(post)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                  {auto && (
                    <form action={publishNow.bind(null, post.id)}>
                      <SubmitButton className={buttonPrimarySm}>{t('publishNow')}</SubmitButton>
                    </form>
                  )}
                  <form action={setPostStatus.bind(null, post.id, 'reopen')}>
                    <SubmitButton className={buttonSecondarySm}>{t('reopen')}</SubmitButton>
                  </form>
                </div>
                {auto ? (
                  <p className="mt-2 text-xs text-zinc-500">{t('autoHint')}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-zinc-500">{t('manualHint')}</p>
                    {manualPublishForm(post)}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Veroeffentlicht ── */}
      <h2 className="mt-10 text-base font-semibold text-zinc-950">{t('publishedHeading')}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t('publishedBody')}</p>
      {(published ?? []).length === 0 ? (
        <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          {t('publishedEmpty')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-surface border border-zinc-200 bg-white">
          {(published ?? []).map((post) => {
            const latest = latestSnapshot(post.vsm_social_metrics ?? [])
            const seen = latest ? visibility(latest) : null
            const apiMetrics = isChannel(post.channel) && channelHasMetrics(post.channel) && post.external_id
            return (
              <li key={post.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {meta(post)}
                  <span className="text-sm tabular-nums text-zinc-900">
                    {seen !== null ? t('seenAfter', { seen: nf.format(seen), hours: latest!.age_hours }) : t('noMetrics')}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-700">{post.body.split('\n')[0]}</p>
                {post.external_url && (
                  <a href={post.external_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                    {t('openPost')}
                  </a>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-brand-600">
                    {apiMetrics ? t('manualMetricsOptional') : t('manualMetrics')}
                  </summary>
                  <form action={addManualMetrics.bind(null, post.id)} className="mt-2 flex flex-wrap items-end gap-2">
                    {(['impressions', 'reach', 'reactions', 'comments', 'shares', 'saves', 'clicks'] as const).map((field) => (
                      <label key={field} className="text-xs text-zinc-600">
                        {t(`metric_${field}`)}
                        <input name={field} inputMode="numeric" className={`${inputSm} mt-1 block w-24`} />
                      </label>
                    ))}
                    <SubmitButton className={buttonSecondarySm}>{t('saveMetrics')}</SubmitButton>
                  </form>
                  <p className="mt-1 text-xs text-zinc-500">{t('manualMetricsHint')}</p>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
