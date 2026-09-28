'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/crm/staff'
import {
  collectMetrics,
  generateNextWeek,
  hoursSince,
  publishPost,
  runAnalysis,
} from '@/lib/social/runner'

/**
 * Die Knoepfe des Social-Media-Bereichs.
 *
 * Bearbeiten, Freigeben, Verwerfen laufen ueber den *angemeldeten* Client —
 * die Policy "staff can update social posts" prueft mit. Alles, was Claude
 * aufruft, postet oder Entwuerfe anlegt, braucht den Service-Role-Client
 * (siehe lib/social/runner.ts) und prueft deshalb vorher `requireStaff()`.
 */

const QUEUE = '/admin/social/queue'
const OVERVIEW = '/admin/social'

function back(path: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params)
  redirect(`${path}?${qs}`)
}

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300)
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function count(formData: FormData, key: string): number | null {
  const raw = text(formData, key)
  if (raw === null) return null
  // Tausendertrennzeichen, wie sie LinkedIn und Instagram anzeigen
  // ("1’234", "1.234", "1,234"), duerfen mitkopiert werden.
  const n = Number(raw.replace(/[’'.,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

export async function saveDraft(postId: string, formData: FormData) {
  await requireStaff()
  const body = text(formData, 'body')
  const scheduledFor = text(formData, 'scheduled_for')
  if (!body || !scheduledFor || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
    back(QUEUE, { error: 'invalid' })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vsm_social_posts')
    .update({
      body,
      card_headline: text(formData, 'card_headline'),
      card_subline: text(formData, 'card_subline'),
      scheduled_for: scheduledFor,
    })
    .eq('id', postId)
    .in('status', ['draft', 'approved', 'failed'])

  if (error) back(QUEUE, { error: 'save', msg: error.message })
  revalidatePath(QUEUE)
  back(QUEUE, { notice: 'saved' })
}

/** Freigeben, Verwerfen, zurueck zum Entwurf. Welcher Uebergang von wo aus
 *  erlaubt ist, steht hier und nirgends sonst. */
const TRANSITIONS = {
  approve: { to: 'approved', from: ['draft', 'failed'] },
  reject: { to: 'rejected', from: ['draft', 'approved', 'failed'] },
  // Auch aus 'publishing': Ein Lauf, der mitten im Posten abgebrochen ist,
  // hinterlaesst die Sperre. Vor dem Zuruecksetzen auf der Plattform
  // nachsehen, ob der Beitrag nicht doch erschienen ist.
  reopen: { to: 'draft', from: ['approved', 'failed', 'publishing', 'rejected'] },
} as const

export async function setPostStatus(postId: string, action: keyof typeof TRANSITIONS) {
  const staff = await requireStaff()
  const transition = TRANSITIONS[action]
  if (!transition) back(QUEUE, { error: 'invalid' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('vsm_social_posts')
    .update({
      status: transition.to,
      approved_by: transition.to === 'approved' ? staff.userId : null,
      last_error: null,
    })
    .eq('id', postId)
    .in('status', [...transition.from])

  if (error) back(QUEUE, { error: 'save', msg: error.message })
  revalidatePath(QUEUE)
  back(QUEUE, { notice: action })
}

/** Sofort posten, statt auf den naechsten Morgen zu warten. Nur fuer bereits
 *  freigegebene Beitraege — Freigeben und Posten bleiben zwei Klicks. */
export async function publishNow(postId: string) {
  await requireStaff()
  if (!hasAdminCredentials()) back(QUEUE, { error: 'notConfigured' })

  const db = createAdminClient()
  const { data: post } = await db.from('vsm_social_posts').select('*').eq('id', postId).maybeSingle()
  if (!post) back(QUEUE, { error: 'invalid' })

  const result = await publishPost(db, post)
  revalidatePath(QUEUE)
  revalidatePath(OVERVIEW)
  if (!result.ok) back(QUEUE, { error: 'publish', msg: result.error ?? '' })
  back(QUEUE, { notice: 'published' })
}

/** Handbetrieb: Der Beitrag wurde von Hand gepostet. */
export async function markPublished(postId: string, formData: FormData) {
  await requireStaff()
  const url = text(formData, 'external_url')
  const date = text(formData, 'published_on')
  if (url && !/^https:\/\//.test(url)) back(QUEUE, { error: 'invalid' })

  // Mittag statt Mitternacht: Das Alter beim Messen wird aus diesem
  // Zeitpunkt gerechnet, und ohne Uhrzeit ist die Mitte des Tages der
  // kleinste Fehler.
  const publishedAt = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : new Date().toISOString()

  const supabase = await createClient()
  const { error } = await supabase
    .from('vsm_social_posts')
    .update({ status: 'published', published_at: publishedAt, external_url: url, last_error: null })
    .eq('id', postId)
    .in('status', ['draft', 'approved', 'failed'])

  if (error) back(QUEUE, { error: 'save', msg: error.message })
  revalidatePath(QUEUE)
  back(QUEUE, { notice: 'published' })
}

/** Handbetrieb: Messwerte, abgelesen in der Statistik der Plattform. */
export async function addManualMetrics(postId: string, formData: FormData) {
  await requireStaff()
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('vsm_social_posts')
    .select('published_at')
    .eq('id', postId)
    .maybeSingle()
  if (!post?.published_at) back(QUEUE, { error: 'invalid' })

  const values = {
    impressions: count(formData, 'impressions'),
    reach: count(formData, 'reach'),
    reactions: count(formData, 'reactions'),
    comments: count(formData, 'comments'),
    shares: count(formData, 'shares'),
    saves: count(formData, 'saves'),
    clicks: count(formData, 'clicks'),
  }
  if (values.impressions === null && values.reach === null) back(QUEUE, { error: 'needVisibility' })

  const { error } = await supabase.from('vsm_social_metrics').insert({
    post_id: postId,
    age_hours: Math.max(0, hoursSince(post.published_at, new Date())),
    source: 'manual',
    ...values,
  })
  if (error) back(QUEUE, { error: 'save', msg: error.message })
  revalidatePath(QUEUE)
  revalidatePath(OVERVIEW)
  back(QUEUE, { notice: 'metrics' })
}

export async function generateDraftsNow() {
  await requireStaff()
  if (!hasAdminCredentials()) back(OVERVIEW, { error: 'notConfigured' })

  let created = 0
  let skipped: string | undefined
  try {
    ;({ created, skipped } = await generateNextWeek(createAdminClient(), new Date(), { force: true }))
  } catch (err) {
    back(OVERVIEW, { error: 'generate', msg: errorText(err) })
  }
  revalidatePath(QUEUE)
  if (created === 0) back(OVERVIEW, { notice: 'nothing', msg: skipped ?? '' })
  back(QUEUE, { notice: 'generated', msg: String(created) })
}

export async function analyzeNow() {
  const staff = await requireStaff()
  if (!hasAdminCredentials()) back(OVERVIEW, { error: 'notConfigured' })

  let result: { created: boolean; reason: string }
  try {
    result = await runAnalysis(createAdminClient(), staff.userId)
  } catch (err) {
    back(OVERVIEW, { error: 'analyze', msg: errorText(err) })
  }
  revalidatePath(OVERVIEW)
  back(OVERVIEW, { notice: result.created ? 'analyzed' : 'nothing', msg: result.reason })
}

export async function fetchMetricsNow() {
  await requireStaff()
  if (!hasAdminCredentials()) back(OVERVIEW, { error: 'notConfigured' })

  // `back()` steht bewusst ausserhalb des try: `redirect()` wirft selbst,
  // und das catch wuerde die Weiterleitung sonst als Fehler verbuchen.
  let results: Awaited<ReturnType<typeof collectMetrics>>
  try {
    results = await collectMetrics(createAdminClient(), new Date())
  } catch (err) {
    back(OVERVIEW, { error: 'metrics', msg: errorText(err) })
  }
  revalidatePath(OVERVIEW)
  const failed = results.find((r) => !r.ok)
  if (failed) back(OVERVIEW, { error: 'metrics', msg: failed.error ?? '' })
  back(OVERVIEW, { notice: 'fetched', msg: String(results.length) })
}
