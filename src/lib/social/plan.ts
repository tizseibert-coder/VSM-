// Der Wochenplan: welche Plaetze es gibt und was auf jeden kommt.
//
// Geplant wird immer die *naechste* Kalenderwoche (Montag bis Sonntag). Der
// Entwurf entsteht also mit Vorlauf, und zwischen Entwurf und erstem
// Veroeffentlichungstag liegt Zeit fuer die Freigabe.

import { CHANNELS, EXPLORE_SHARE, WEEKLY_SCHEDULE, type Channel } from './config'
import { chooseArm, randomArm, type ArmStats, type Rng } from './bandit'

export type Slot = { date: string; channel: Channel }

export type PlannedSlot = Slot & {
  topic: string
  format: string
  /** Bewusster Versuch ausserhalb des Bewaehrten: zufaelliger Arm, und der
   *  Agent soll einen neuen Blickwinkel waehlen. */
  explore: boolean
}

/** YYYY-MM-DD in UTC. Der taegliche Lauf feuert morgens europaeischer Zeit,
 *  da ist das UTC-Datum dasselbe. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Montag der Woche nach `today` (UTC). */
export function nextMonday(today: Date): Date {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (8 - weekday))
  return d
}

export function weekSlots(monday: Date): Slot[] {
  const slots: Slot[] = []
  for (const channel of CHANNELS) {
    for (const weekday of WEEKLY_SCHEDULE[channel]) {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + weekday - 1)
      slots.push({ date: isoDate(d), channel })
    }
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel))
}

/**
 * Belegt die Plaetze. Je Kanal wird ein Anteil `EXPLORE_SHARE` (mindestens
 * einer, sobald der Kanal drei Plaetze hat) als Versuch markiert.
 */
export function planWeek(slots: Slot[], stats: Map<string, ArmStats>, rng: Rng): PlannedSlot[] {
  const used = new Map<Channel, Set<string>>()
  const exploreIndexes = new Set<number>()

  for (const channel of CHANNELS) {
    const indexes = slots.flatMap((s, i) => (s.channel === channel ? [i] : []))
    const count = indexes.length >= 3 ? Math.max(1, Math.round(indexes.length * EXPLORE_SHARE)) : 0
    const pool = [...indexes]
    for (let n = 0; n < count && pool.length > 0; n++) {
      const pick = Math.floor(rng() * pool.length)
      exploreIndexes.add(pool[pick])
      pool.splice(pick, 1)
    }
  }

  return slots.map((slot, i) => {
    const exclude = used.get(slot.channel) ?? new Set<string>()
    const explore = exploreIndexes.has(i)
    const arm = explore
      ? randomArm(slot.channel, rng, exclude)
      : chooseArm(slot.channel, stats, rng, exclude)
    exclude.add(arm.topic)
    used.set(slot.channel, exclude)
    return { ...slot, topic: arm.topic, format: arm.format, explore }
  })
}
