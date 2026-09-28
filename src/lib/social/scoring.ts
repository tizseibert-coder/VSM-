// Wie gut ein Beitrag war — gemessen an dem, was das Ziel ist: Reichweite.
//
// Bewusst eine einzige Zahl und keine gewichtete Mischung aus Likes,
// Kommentaren und Teilungen. Jede Gewichtung waere eine Behauptung ("ein
// Kommentar ist zehn Likes wert"), die niemand belegen kann; die Plattformen
// rechnen Interaktionen ohnehin selbst in Reichweite um. Was bleibt, ist
// die Zahl, die das Ziel direkt misst: wie oft der Beitrag gesehen wurde.
//
// Verglichen wird *relativ zum Median des eigenen Kanals*. Absolute Zahlen
// wuerden LinkedIn gegen Instagram antreten lassen, und ein Kanal mit mehr
// Folgern gewaenne jeden Vergleich, unabhaengig vom Inhalt.

import { MIN_AGE_FOR_SCORING_HOURS, type Channel } from './config'

export type MetricSnapshot = {
  age_hours: number
  impressions: number | null
  reach: number | null
  reactions: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  clicks: number | null
}

export type PostForScoring = {
  id: string
  channel: Channel
  topic: string
  format: string
  hook: string
  explore: boolean
  metrics: MetricSnapshot[]
}

export type ScoredPost = PostForScoring & {
  latest: MetricSnapshot
  score: number
  /** Score geteilt durch den Median des Kanals. 1 = durchschnittlich. */
  relative: number
  /** Ueber dem Median des Kanals. Das ist der "Treffer" fuer die Auswahl. */
  win: boolean
  engagementRate: number | null
}

/** Der juengste Messpunkt, gemessen am Alter des Beitrags — nicht am
 *  Einfuegezeitpunkt, weil ein von Hand nachgetragener alter Wert sonst
 *  einen neueren verdraengen koennte. */
export function latestSnapshot(metrics: MetricSnapshot[]): MetricSnapshot | null {
  if (metrics.length === 0) return null
  return metrics.reduce((best, m) => (m.age_hours > best.age_hours ? m : best))
}

/** Sichtbarkeit: Impressionen, ersatzweise Reichweite (Instagram liefert
 *  je nach Kontotyp nur eines von beiden). Null, wenn keines da ist — dann
 *  ist der Beitrag nicht bewertbar, statt mit 0 als Flop zu gelten. */
export function visibility(m: MetricSnapshot): number | null {
  return m.impressions ?? m.reach ?? null
}

/** Interaktionen je Sichtkontakt. Nur zur Anzeige und fuer die
 *  Wochenanalyse — nicht das, wonach ausgewaehlt wird. */
export function engagementRate(m: MetricSnapshot): number | null {
  const seen = visibility(m)
  if (!seen) return null
  const interactions =
    (m.reactions ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0) + (m.clicks ?? 0)
  return interactions / seen
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Bewertet alle Beitraege, die alt genug sind und eine Sichtbarkeitszahl
 * haben. Juengere fehlen im Ergebnis, statt schlecht auszusehen.
 */
export function scorePosts(posts: PostForScoring[]): ScoredPost[] {
  const eligible = posts.flatMap((post) => {
    const latest = latestSnapshot(post.metrics)
    if (!latest || latest.age_hours < MIN_AGE_FOR_SCORING_HOURS) return []
    const score = visibility(latest)
    if (score === null) return []
    return [{ post, latest, score }]
  })

  const medians = new Map<Channel, number>()
  for (const channel of new Set(eligible.map((e) => e.post.channel))) {
    const m = median(eligible.filter((e) => e.post.channel === channel).map((e) => e.score))
    if (m !== null) medians.set(channel, m)
  }

  return eligible.map(({ post, latest, score }) => {
    const channelMedian = medians.get(post.channel) ?? 0
    // Median 0 (alle bisherigen ohne Sichtkontakt) hiesse Division durch
    // null. Dann gilt jeder Beitrag mit ueberhaupt einem Sichtkontakt als
    // ueberdurchschnittlich.
    const relative = channelMedian > 0 ? score / channelMedian : score > 0 ? 2 : 1
    return {
      ...post,
      latest,
      score,
      relative,
      win: relative > 1,
      engagementRate: engagementRate(latest),
    }
  })
}
