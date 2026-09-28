import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasAdminCredentials } from '@/lib/supabase/admin'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'
import { CHANNELS, TOPICS, type Channel } from '@/lib/social/config'
import { channelConfigured, channelHasMetrics } from '@/lib/social/publishers'
import { hasAnthropicCredentials } from '@/lib/social/agent'
import { daysAgo, loadScoringData, latestPlaybook, MIN_POSTS_FOR_ANALYSIS } from '@/lib/social/runner'
import { median } from '@/lib/social/scoring'
import { SocialHeader } from './SocialHeader'
import { analyzeNow, fetchMetricsNow, generateDraftsNow } from './actions'

/**
 * Was funktioniert: Kennzahlen je Kanal, das aktuelle Regelwerk und die
 * Bilanz jedes Themas.
 *
 * Bewusst Tabellen statt Diagramme, aus demselben Grund wie auf der
 * Verwaltungsuebersicht: Bei einer Handvoll Beitraege pro Woche liest man
 * eine Zahl schneller als einen Balken. Ein Verlauf lohnt sich, wenn nach
 * ein paar Monaten genug Geschichte da ist.
 *
 * `maxDuration`: Entwerfen und Auswerten rufen Claude mit Nachdenken auf.
 */
export const maxDuration = 300

type SearchParams = Promise<{ notice?: string; error?: string; msg?: string }>

type Summary = { headline?: string; working?: string[]; not_working?: string[]; next_tests?: string[] }

export default async function SocialOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error, msg } = await searchParams
  const t = await getTranslations('Social')
  const locale = await getLocale()
  const nf = new Intl.NumberFormat(locale)
  const pf = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  // Gelesen unter RLS mit dem angemeldeten Client — dieselbe Auswertung wie
  // im taeglichen Lauf, nur mit den Rechten des Betrachters.
  const supabase = await createClient()
  const [{ scored, posts }, playbook] = await Promise.all([loadScoringData(supabase), latestPlaybook(supabase)])
  const summary = (playbook?.summary ?? null) as Summary | null

  const monthAgo = daysAgo(30).getTime()
  const channelStats = CHANNELS.map((channel) => {
    const mine = scored.filter((p) => p.channel === channel)
    const recentPosts = posts.filter(
      (p) => p.channel === channel && p.published_at && new Date(p.published_at).getTime() >= monthAgo
    )
    const rates = mine.map((p) => p.engagementRate).filter((r): r is number => r !== null)
    return {
      channel,
      published30: recentPosts.length,
      scoredCount: mine.length,
      medianSeen: median(mine.map((p) => p.score)),
      medianRate: median(rates),
    }
  })

  // Bilanz je Thema und Kanal (ueber alle Formate): Wie oft ueber dem
  // Median, und wie weit im Schnitt.
  const topicRows = CHANNELS.flatMap((channel) =>
    TOPICS.map((topic) => {
      const mine = scored.filter((p) => p.channel === channel && p.topic === topic.id)
      const wins = mine.filter((p) => p.win).length
      const avgRelative = mine.length ? mine.reduce((s, p) => s + p.relative, 0) / mine.length : null
      return { channel, topic, n: mine.length, wins, avgRelative }
    })
  )
    .filter((r) => r.n > 0)
    .sort((a, b) => (b.avgRelative ?? 0) - (a.avgRelative ?? 0))

  const top = [...scored].sort((a, b) => b.relative - a.relative).slice(0, 5)

  const channelStatus = (channel: Channel) =>
    !channelConfigured(channel) ? t('statusManual') : channelHasMetrics(channel) ? t('statusAuto') : t('statusAutoNoMetrics')

  const statusCards = [
    { label: t('channel_linkedin'), value: channelStatus('linkedin'), ok: channelConfigured('linkedin') },
    { label: t('channel_instagram'), value: channelStatus('instagram'), ok: channelConfigured('instagram') },
    { label: 'Claude', value: hasAnthropicCredentials() ? t('statusReady') : t('statusMissing', { name: 'ANTHROPIC_API_KEY' }), ok: hasAnthropicCredentials() },
    {
      label: t('statusCron'),
      value: process.env.CRON_SECRET && hasAdminCredentials() ? t('statusCronOn') : t('statusMissing', { name: 'CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY' }),
      ok: Boolean(process.env.CRON_SECRET && hasAdminCredentials()),
    },
  ]

  return (
    <div>
      <SocialHeader active="overview" notice={notice} error={error} msg={msg} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-surface border px-4 py-3 ${card.ok ? 'border-zinc-200 bg-white' : 'border-amber-300 bg-amber-50'}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">{card.label}</p>
            <p className="mt-1 text-sm text-zinc-800">{card.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{t('setupHint')}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <form action={generateDraftsNow}>
          <SubmitButton className={buttonPrimary}>{t('generateNow')}</SubmitButton>
        </form>
        <form action={analyzeNow}>
          <SubmitButton className={buttonSecondary}>{t('analyzeNow')}</SubmitButton>
        </form>
        <form action={fetchMetricsNow}>
          <SubmitButton className={buttonSecondary}>{t('fetchMetricsNow')}</SubmitButton>
        </form>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{t('rhythmHint')}</p>

      {/* ── Kennzahlen je Kanal ── */}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
        {channelStats.map((s) => (
          <div key={s.channel} className="bg-white px-5 py-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t(`channel_${s.channel}`)}</dt>
            <dd className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-zinc-500">{t('kpiPublished30')}</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-950">{nf.format(s.published30)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('kpiMedianSeen')}</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-950">
                  {s.medianSeen !== null ? nf.format(Math.round(s.medianSeen)) : '–'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('kpiMedianRate')}</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-950">
                  {s.medianRate !== null ? pf.format(s.medianRate) : '–'}
                </p>
              </div>
            </dd>
            <p className="mt-2 text-xs text-zinc-500">{t('kpiScoredCount', { count: s.scoredCount })}</p>
          </div>
        ))}
      </dl>

      {/* ── Regelwerk ── */}
      <h2 className="mt-10 text-base font-semibold text-zinc-950">{t('playbookHeading')}</h2>
      {!playbook ? (
        <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          {t('playbookEmpty', { min: MIN_POSTS_FOR_ANALYSIS })}
        </p>
      ) : (
        <section className="mt-3 rounded-surface border border-zinc-200 bg-white p-5">
          <p className="text-xs text-zinc-500">
            {t('playbookMeta', { date: dtf.format(new Date(playbook.created_at)), count: playbook.posts_analyzed })}
          </p>
          {summary?.headline && <p className="mt-2 text-base font-medium text-zinc-950">{summary.headline}</p>}
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {(
              [
                ['working', t('working')],
                ['not_working', t('notWorking')],
                ['next_tests', t('nextTests')],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-800">
                  {(summary?.[key] ?? []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <details className="mt-4 border-t border-zinc-100 pt-3">
            <summary className="cursor-pointer text-sm text-brand-600 hover:underline">{t('playbookFull')}</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-800">
              {playbook.body}
            </pre>
          </details>
        </section>
      )}

      {/* ── Themenbilanz ── */}
      <h2 className="mt-10 text-base font-semibold text-zinc-950">{t('topicsHeading')}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t('topicsBody')}</p>
      {topicRows.length === 0 ? (
        <p className="mt-3 rounded-surface border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          {t('topicsEmpty')}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t('colChannel')}</th>
                <th className="px-4 py-2 font-medium">{t('colTopic')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('colPosts')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('colWins')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('colRelative')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {topicRows.map((r) => (
                <tr key={`${r.channel}-${r.topic.id}`}>
                  <td className="px-4 py-2 text-zinc-600">{t(`channel_${r.channel}`)}</td>
                  <td className="px-4 py-2 text-zinc-900">{r.topic.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.n}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.wins}/{r.n}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium tabular-nums ${
                      (r.avgRelative ?? 0) >= 1 ? 'text-brand-700' : 'text-zinc-500'
                    }`}
                  >
                    {r.avgRelative !== null ? `${r.avgRelative.toFixed(2)}×` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Beste Beitraege ── */}
      {top.length > 0 && (
        <>
          <h2 className="mt-10 text-base font-semibold text-zinc-950">{t('topHeading')}</h2>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-surface border border-zinc-200 bg-white">
            {top.map((p) => {
              const post = posts.find((x) => x.id === p.id)
              return (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-500">
                      {t(`channel_${p.channel}`)} · {p.topic} · {p.format} · {p.hook}
                    </p>
                    <p className="truncate text-sm text-zinc-800">{post?.body.split('\n')[0]}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-zinc-950">
                    {nf.format(p.score)} · {p.relative.toFixed(1)}×
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
