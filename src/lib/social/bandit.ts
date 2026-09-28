// Welches Thema in welchem Format als Naechstes drankommt.
//
// Thompson Sampling: Jede Kombination (Kanal × Thema × Format) ist ein Arm
// mit einer Beta-Verteilung aus ihren Treffern (ueber dem Kanal-Median) und
// Nieten. Fuer jeden freien Platz wird aus jeder Verteilung einmal gezogen,
// der hoechste Wert gewinnt. Das ergibt von selbst die richtige Mischung:
// Was sich bewaehrt hat, zieht oft hohe Werte und kommt oft dran; was selten
// getestet wurde, hat eine breite Verteilung und kommt ab und zu trotzdem
// dran — ohne dass jemand eine Quote festlegen muss.
//
// Der Zufall ist injizierbar, damit die Tests reproduzierbar sind.

import { FORMATS, TOPICS, type Channel } from './config'
import type { ScoredPost } from './scoring'

export type Rng = () => number

export type Arm = { channel: Channel; topic: string; format: string }
export type ArmStats = { wins: number; losses: number }

export function armKey(arm: Arm): string {
  return `${arm.channel}|${arm.topic}|${arm.format}`
}

export function allArms(channel: Channel): Arm[] {
  return TOPICS.flatMap((topic) =>
    FORMATS[channel].map((format) => ({ channel, topic: topic.id, format: format.id }))
  )
}

export function collectArmStats(scored: ScoredPost[]): Map<string, ArmStats> {
  const stats = new Map<string, ArmStats>()
  for (const post of scored) {
    const key = armKey(post)
    const current = stats.get(key) ?? { wins: 0, losses: 0 }
    if (post.win) current.wins += 1
    else current.losses += 1
    stats.set(key, current)
  }
  return stats
}

/** Standardnormalverteilt (Box-Muller). */
function sampleNormal(rng: Rng): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Gamma(shape, 1) nach Marsaglia/Tsang; fuer shape < 1 ueber den
 *  ueblichen Umweg shape + 1. */
function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, rng) * Math.pow(Math.max(rng(), Number.EPSILON), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = sampleNormal(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x ** 4) return d * v
    if (Math.log(Math.max(u, Number.EPSILON)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = sampleGamma(alpha, rng)
  const y = sampleGamma(beta, rng)
  return x / (x + y)
}

/**
 * Waehlt einen Arm. `excludeTopics` sind Themen, die in derselben Woche auf
 * diesem Kanal schon vergeben sind: Ohne sie kaeme das aktuell beste Thema
 * dreimal hintereinander dran, und der Kanal wuerde eintoenig. Sind alle
 * ausgeschlossen, zaehlt der Ausschluss nicht mehr.
 */
export function chooseArm(
  channel: Channel,
  stats: Map<string, ArmStats>,
  rng: Rng,
  excludeTopics: Set<string> = new Set()
): Arm {
  const candidates = allArms(channel)
  const open = candidates.filter((arm) => !excludeTopics.has(arm.topic))
  const pool = open.length > 0 ? open : candidates

  let best = pool[0]
  let bestDraw = -1
  for (const arm of pool) {
    const s = stats.get(armKey(arm)) ?? { wins: 0, losses: 0 }
    const draw = sampleBeta(s.wins + 1, s.losses + 1, rng)
    if (draw > bestDraw) {
      best = arm
      bestDraw = draw
    }
  }
  return best
}

/** Gleichverteilt, fuer die bewussten Ausreisser (siehe plan.ts). */
export function randomArm(channel: Channel, rng: Rng, excludeTopics: Set<string> = new Set()): Arm {
  const candidates = allArms(channel)
  const open = candidates.filter((arm) => !excludeTopics.has(arm.topic))
  const pool = open.length > 0 ? open : candidates
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}

/** Ein reproduzierbarer Zufallsgenerator (mulberry32) fuer Tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
