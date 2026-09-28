// Die Ablaeufe des Agenten: planen, posten, messen, lernen.
//
// Jede Funktion hier ist fuer sich aufrufbar — vom taeglichen Lauf
// (api/social/cron) ebenso wie von den Knoepfen im Verwaltungsbereich. Und
// jede ist so gebaut, dass ein doppelter Aufruf nichts doppelt tut: Ein
// Cron-Lauf, den Vercel wiederholt, soll weder zwei Wochenplaene noch zwei
// Beitraege erzeugen.
//
// Alle laufen ueber den Service-Role-Client: Der Cron-Lauf hat keinen
// angemeldeten Nutzer, und das Anlegen von Entwuerfen hat bewusst keine
// Policy (siehe Migration 20260928120000). Wer sie aus einer Server Action
// aufruft, prueft vorher `requireStaff()`.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { siteUrl } from '@/lib/seo/site'
import { analyzePerformance, writeDrafts } from './agent'
import { collectArmStats, type Rng } from './bandit'
import { METRIC_CHECKPOINTS_HOURS, formatNeedsCard, isChannel, type Channel } from './config'
import { isoDate, nextMonday, planWeek, weekSlots } from './plan'
import { channelConfigured, channelHasMetrics, fetchMetrics, publishTo } from './publishers'
import { scorePosts, type PostForScoring } from './scoring'

type Db = SupabaseClient<Database>
type PostRow = Database['public']['Tables']['vsm_social_posts']['Row']

/** Oeffentliche Adresse der Kachel. Instagram laedt sie selbst ab, deshalb
 *  muss NEXT_PUBLIC_SITE_URL auf die echte Domain zeigen. */
export function cardUrl(postId: string): string {
  return `${siteUrl()}/api/social/card/${postId}`
}

/** Zeitpunkt vor `days` Tagen. Ausserhalb der Seiten, weil die
 *  Reinheitsregel fuer Komponenten `Date.now()` im Rendern nicht zulaesst —
 *  auf einer Serverseite, die bei jedem Aufruf neu rechnet, ist das genau
 *  gewollt. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

export function hoursSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000)
}

// ─────────────────────────────────────────────
// Daten fuer Auswertung und Planung
// ─────────────────────────────────────────────

export async function loadScoringData(db: Db) {
  const { data: posts, error } = await db
    .from('vsm_social_posts')
    .select('id, channel, topic, format, hook, explore, body, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Beitraege laden: ${error.message}`)

  const ids = (posts ?? []).map((p) => p.id)
  const { data: metrics, error: metricsError } = ids.length
    ? await db
        .from('vsm_social_metrics')
        .select('post_id, age_hours, impressions, reach, reactions, comments, shares, saves, clicks')
        .in('post_id', ids)
    : { data: [], error: null }
  if (metricsError) throw new Error(`Messwerte laden: ${metricsError.message}`)

  const byPost = new Map<string, PostForScoring['metrics']>()
  for (const m of metrics ?? []) {
    const list = byPost.get(m.post_id) ?? []
    list.push(m)
    byPost.set(m.post_id, list)
  }

  const forScoring: PostForScoring[] = (posts ?? []).flatMap((p) =>
    isChannel(p.channel)
      ? [{ id: p.id, channel: p.channel, topic: p.topic, format: p.format, hook: p.hook, explore: p.explore, metrics: byPost.get(p.id) ?? [] }]
      : []
  )

  return {
    posts: posts ?? [],
    scored: scorePosts(forScoring),
    bodies: new Map((posts ?? []).map((p) => [p.id, p.body])),
  }
}

export async function latestPlaybook(db: Db) {
  const { data } = await db
    .from('vsm_social_playbooks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// ─────────────────────────────────────────────
// Planen
// ─────────────────────────────────────────────

export type GenerateResult = { created: number; skipped?: string }

/**
 * Entwuerfe fuer die naechste Kalenderwoche. Gibt es fuer diese Woche schon
 * Beitraege (gleich welchen Status), passiert nichts — es sei denn `force`,
 * dann kommen die fehlenden Plaetze dazu.
 */
export async function generateNextWeek(
  db: Db,
  now: Date,
  options: { force?: boolean; rng?: Rng } = {}
): Promise<GenerateResult> {
  const slots = weekSlots(nextMonday(now))
  const dates = slots.map((s) => s.date)

  const { data: existing, error } = await db
    .from('vsm_social_posts')
    .select('channel, scheduled_for')
    .in('scheduled_for', dates)
    .neq('status', 'rejected')
  if (error) throw new Error(`Wochenplan pruefen: ${error.message}`)

  if (existing && existing.length > 0 && !options.force) {
    return { created: 0, skipped: 'Für die nächste Woche gibt es bereits Entwürfe.' }
  }
  const taken = new Set((existing ?? []).map((e) => `${e.channel}|${e.scheduled_for}`))
  const open = slots.filter((s) => !taken.has(`${s.channel}|${s.date}`))
  if (open.length === 0) return { created: 0, skipped: 'Alle Plätze der nächsten Woche sind belegt.' }

  const { scored, bodies, posts } = await loadScoringData(db)
  const playbook = await latestPlaybook(db)
  const planned = planWeek(open, collectArmStats(scored), options.rng ?? Math.random)

  const drafts = await writeDrafts({
    slots: planned,
    playbook: playbook?.body ?? null,
    scored,
    bodies,
    recentBodies: posts.slice(0, 15).map((p) => p.body),
  })

  if (drafts.length === 0) return { created: 0, skipped: 'Claude hat keine Entwürfe geliefert.' }

  const { error: insertError } = await db.from('vsm_social_posts').insert(
    drafts.map((d) => ({
      channel: d.slot.channel,
      topic: d.slot.topic,
      format: d.slot.format,
      explore: d.slot.explore,
      hook: d.hook,
      body: d.body,
      card_headline: d.card_headline,
      card_subline: d.card_subline,
      rationale: d.rationale,
      scheduled_for: d.slot.date,
    }))
  )
  if (insertError) throw new Error(`Entwuerfe speichern: ${insertError.message}`)
  return { created: drafts.length }
}

// ─────────────────────────────────────────────
// Posten
// ─────────────────────────────────────────────

export async function publishPost(db: Db, post: PostRow): Promise<{ ok: boolean; error?: string }> {
  if (!isChannel(post.channel) || !channelConfigured(post.channel)) {
    return { ok: false, error: 'Kanal ist nicht eingerichtet (Handbetrieb).' }
  }
  // Doppelt posten ist das Einzige hier, das man nicht zuruecknehmen kann.
  // Deshalb wird der Beitrag zuerst *bedingt* auf 'publishing' gesetzt: Laufen
  // Cron und Knopf gleichzeitig, bekommt nur einer die Zeile zurueck.
  const { data: claimed } = await db
    .from('vsm_social_posts')
    .update({ status: 'publishing' })
    .eq('id', post.id)
    .eq('status', 'approved')
    .select('id')
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: 'Beitrag ist nicht (mehr) freigegeben oder wird gerade gepostet.' }
  }

  const withCard = formatNeedsCard(post.channel, post.format)
  try {
    const result = await publishTo(post.channel, {
      body: post.body,
      imageUrl: withCard ? cardUrl(post.id) : null,
      imageAlt: post.card_headline,
    })
    await db
      .from('vsm_social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_id: result.externalId,
        external_url: result.externalUrl,
        last_error: null,
      })
      .eq('id', post.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.from('vsm_social_posts').update({ status: 'failed', last_error: message }).eq('id', post.id)
    return { ok: false, error: message }
  }
}

/** Alles Freigegebene, dessen Tag gekommen ist, auf eingerichteten Kanaelen. */
export async function publishDue(db: Db, now: Date) {
  const { data: due, error } = await db
    .from('vsm_social_posts')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_for', isoDate(now))
    .order('scheduled_for')
  if (error) throw new Error(`Faellige Beitraege laden: ${error.message}`)

  const results: { id: string; channel: string; ok: boolean; error?: string }[] = []
  for (const post of due ?? []) {
    if (!isChannel(post.channel) || !channelConfigured(post.channel)) continue
    results.push({ id: post.id, channel: post.channel, ...(await publishPost(db, post)) })
  }
  return results
}

// ─────────────────────────────────────────────
// Messen
// ─────────────────────────────────────────────

/**
 * Holt Messwerte fuer jeden Beitrag, der einen Messzeitpunkt (24 h, 72 h,
 * 7 Tage) ueberschritten hat, fuer den es noch keinen Messpunkt gibt. Je
 * Beitrag und Lauf hoechstens ein Abruf.
 */
export async function collectMetrics(db: Db, now: Date) {
  const lastCheckpoint = METRIC_CHECKPOINTS_HOURS[METRIC_CHECKPOINTS_HOURS.length - 1]
  const since = new Date(now.getTime() - (lastCheckpoint + 48) * 3_600_000).toISOString()

  const { data: posts, error } = await db
    .from('vsm_social_posts')
    .select('id, channel, external_id, published_at')
    .eq('status', 'published')
    .not('external_id', 'is', null)
    .gte('published_at', since)
  if (error) throw new Error(`Beitraege zum Messen laden: ${error.message}`)

  const results: { id: string; age: number; ok: boolean; error?: string }[] = []
  for (const post of posts ?? []) {
    if (!isChannel(post.channel) || !channelHasMetrics(post.channel as Channel)) continue
    if (!post.published_at || !post.external_id) continue

    const age = hoursSince(post.published_at, now)
    const due = [...METRIC_CHECKPOINTS_HOURS].reverse().find((cp) => age >= cp)
    if (due === undefined) continue

    const { data: have } = await db
      .from('vsm_social_metrics')
      .select('id')
      .eq('post_id', post.id)
      .gte('age_hours', due)
      .limit(1)
    if (have && have.length > 0) continue

    try {
      const m = await fetchMetrics(post.channel, post.external_id)
      if (!m) continue
      const { raw, ...values } = m
      await db.from('vsm_social_metrics').insert({
        post_id: post.id,
        age_hours: age,
        source: 'api',
        raw: raw as Database['public']['Tables']['vsm_social_metrics']['Insert']['raw'],
        ...values,
      })
      results.push({ id: post.id, age, ok: true })
    } catch (err) {
      results.push({ id: post.id, age, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}

// ─────────────────────────────────────────────
// Lernen
// ─────────────────────────────────────────────

/** Unter dieser Zahl ausgewerteter Beitraege gibt es nichts zu lernen, nur
 *  Rauschen zu deuten. */
export const MIN_POSTS_FOR_ANALYSIS = 4

export async function runAnalysis(db: Db, createdBy: string | null) {
  const { scored, bodies } = await loadScoringData(db)
  if (scored.length < MIN_POSTS_FOR_ANALYSIS) {
    return { created: false, reason: `Erst ${scored.length} ausgewertete Beiträge, mindestens ${MIN_POSTS_FOR_ANALYSIS} nötig.` }
  }
  const previous = await latestPlaybook(db)
  const analysis = await analyzePerformance({ scored, bodies, previousPlaybook: previous?.body ?? null })

  const { playbook, ...summary } = analysis
  const { error } = await db.from('vsm_social_playbooks').insert({
    body: playbook,
    summary,
    posts_analyzed: scored.length,
    created_by: createdBy,
  })
  if (error) throw new Error(`Regelwerk speichern: ${error.message}`)
  return { created: true, reason: summary.headline }
}

// ─────────────────────────────────────────────
// Der taegliche Lauf
// ─────────────────────────────────────────────

/** Freitag: auswerten, dann die naechste Woche planen. So liegen die
 *  Entwuerfe uebers Wochenende zur Freigabe bereit. */
export const PLANNING_WEEKDAY = 5

export async function runDaily(db: Db, now: Date) {
  const log: Record<string, unknown> = {}
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      log[name] = await fn()
    } catch (err) {
      // Ein Schritt, der scheitert, haelt die anderen nicht auf: Wenn die
      // Messwerte nicht kommen, soll trotzdem gepostet werden.
      log[name] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  await step('published', () => publishDue(db, now))
  await step('metrics', () => collectMetrics(db, now))
  if (now.getUTCDay() === PLANNING_WEEKDAY) {
    await step('analysis', () => runAnalysis(db, null))
    await step('drafts', () => generateNextWeek(db, now))
  }
  return log
}
