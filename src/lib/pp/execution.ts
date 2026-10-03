// Tagesplanung — Plantreue der Umruestungen: geplant gegen tatsaechlich.
//
// Zeitpunkte sind Wanduhrzeit des Werks als Text ("2026-10-05T14:30"), ohne
// Zeitzone — dieselbe Ueberlegung wie in dates.ts: Gerechnet wird mit dem,
// was auf dem Rüstplan und in der Zeiterfassung steht, nicht mit Zeitpunkten.
//
// Zuordnung: eine Ist-Umruestung gehoert zur geplanten mit gleicher Maschine
// und gleichem Artikel; gibt es mehrere, zur zeitlich naechsten. Plangemaess
// heisst: zugeordnet *und* in der geplanten Schicht begonnen. Wer in der
// richtigen Schicht 40 Minuten spaet ruestet, ist plangemaess, aber im
// Startversatz sichtbar — die beiden Kennzahlen messen Verschiedenes.

import type { ShiftDefinition } from './settings'

export interface PlannedChangeover {
  id: string
  machine: string
  article: string
  plannedStart: string
}

export interface ActualChangeover {
  machine: string
  article: string
  actualStart: string
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Minuten seit 1970 fuer eine Wanduhrzeit — nur fuer Differenzen und Vergleiche. */
export function wallClockMinutes(text: string): number {
  const m = WALL_CLOCK.exec(text)
  if (!m) throw new Error(`Keine Wanduhrzeit (YYYY-MM-DDTHH:MM): ${text}`)
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60_000
}

/**
 * Die Schicht, in die ein Zeitpunkt faellt, als Code plus Starttag der
 * Schicht (02:00 am Dienstag liegt in der Nachtschicht vom Montag). Nur
 * Arbeitsschichten mit Beginn kommen in Frage; null, wenn keine passt.
 */
export function shiftAt(text: string, shifts: readonly ShiftDefinition[]): { code: string; startDay: string } | null {
  const minutes = wallClockMinutes(text)
  const dayStart = Math.floor(minutes / 1440) * 1440
  for (const offsetDays of [0, -1]) {
    const base = dayStart + offsetDays * 1440
    for (const shift of shifts) {
      if (shift.kind !== 'work' || shift.startMinutes === undefined || shift.hours <= 0) continue
      const start = base + shift.startMinutes
      if (minutes >= start && minutes < start + shift.hours * 60) {
        return { code: shift.code, startDay: new Date(base * 60_000).toISOString().slice(0, 10) }
      }
    }
  }
  return null
}

export interface ExecutionStats {
  planned: number
  matched: number
  onPlan: number
  wrongShift: number
  notExecuted: number
  unplanned: number
  /** onPlan / planned in Prozent; null ohne geplante Umruestung. */
  executionRatePct: number | null
  /** Mittlerer Betrag des Startversatzes in Minuten ueber alle zugeordneten. */
  avgStartOffsetMin: number | null
  /** Zuordnung je geplanter Umruestung, fuer die Anzeige in der Tageserfassung. */
  items: {
    id: string
    actualStart: string | null
    offsetMin: number | null
    status: 'onPlan' | 'wrongShift' | 'notExecuted'
  }[]
}

export function executionStats(
  planned: readonly PlannedChangeover[],
  actual: readonly ActualChangeover[],
  shifts: readonly ShiftDefinition[],
): ExecutionStats {
  const remaining = actual.map((a, index) => ({ ...a, index, minutes: wallClockMinutes(a.actualStart) }))
  const used = new Set<number>()

  // Zuerst die zeitlich engsten Paare: sonst nimmt eine frueh geplante Ruestung
  // einer spaeteren den passenden Ist-Eintrag weg.
  const candidates: { p: number; a: number; distance: number }[] = []
  planned.forEach((p, pi) => {
    const pm = wallClockMinutes(p.plannedStart)
    for (const a of remaining) {
      if (a.machine === p.machine && a.article === p.article) {
        candidates.push({ p: pi, a: a.index, distance: Math.abs(a.minutes - pm) })
      }
    }
  })
  candidates.sort((x, y) => x.distance - y.distance)
  const matchOf = new Map<number, number>()
  for (const c of candidates) {
    if (matchOf.has(c.p) || used.has(c.a)) continue
    matchOf.set(c.p, c.a)
    used.add(c.a)
  }

  let onPlan = 0
  let wrongShift = 0
  let offsetSum = 0
  const items: ExecutionStats['items'] = planned.map((p, pi) => {
    const ai = matchOf.get(pi)
    if (ai === undefined) return { id: p.id, actualStart: null, offsetMin: null, status: 'notExecuted' as const }
    const a = actual[ai]
    const offsetMin = wallClockMinutes(a.actualStart) - wallClockMinutes(p.plannedStart)
    offsetSum += Math.abs(offsetMin)
    const plannedShift = shiftAt(p.plannedStart, shifts)
    const actualShift = shiftAt(a.actualStart, shifts)
    const sameShift =
      plannedShift !== null &&
      actualShift !== null &&
      plannedShift.code === actualShift.code &&
      plannedShift.startDay === actualShift.startDay
    if (sameShift) onPlan++
    else wrongShift++
    return { id: p.id, actualStart: a.actualStart, offsetMin, status: sameShift ? ('onPlan' as const) : ('wrongShift' as const) }
  })

  const matched = matchOf.size
  return {
    planned: planned.length,
    matched,
    onPlan,
    wrongShift,
    notExecuted: planned.length - matched,
    unplanned: actual.length - used.size,
    executionRatePct: planned.length > 0 ? (onPlan / planned.length) * 100 : null,
    avgStartOffsetMin: matched > 0 ? offsetSum / matched : null,
    items,
  }
}

/** Gleichzeitige Ruestungen: mehr als `capacity` Ruestungen ueberlappen sich zeitlich. */
export function findSetupConflicts(
  setups: readonly { id: string; start: string; durationMin: number }[],
  capacity = 1,
): { start: string; ids: string[] }[] {
  const events = setups.flatMap((s) => {
    const start = wallClockMinutes(s.start)
    return [
      { t: start, delta: 1, id: s.id, label: s.start },
      // Mindestens eine Minute: Bei Dauer 0 kaeme das Ende sonst vor dem
      // Beginn an die Reihe, und die Ruestung bliebe fuer immer „aktiv".
      { t: start + Math.max(1, s.durationMin), delta: -1, id: s.id, label: s.start },
    ]
  })
  // Ende vor Beginn bei gleicher Minute: wer um 10:00 fertig ist, kollidiert
  // nicht mit dem, der um 10:00 anfaengt.
  events.sort((a, b) => a.t - b.t || a.delta - b.delta)
  const active = new Map<string, string>()
  const conflicts: { start: string; ids: string[] }[] = []
  for (const e of events) {
    if (e.delta < 0) {
      active.delete(e.id)
      continue
    }
    active.set(e.id, e.label)
    if (active.size > capacity) conflicts.push({ start: e.label, ids: [...active.keys()] })
  }
  return conflicts
}
