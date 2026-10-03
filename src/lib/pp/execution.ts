// Tagesplanung — Plantreue der Umruestungen: geplant gegen tatsaechlich.
//
// Zeitpunkte sind Wanduhrzeit des Werks als Text ("2026-10-05T14:30"), ohne
// Zeitzone — dieselbe Ueberlegung wie in dates.ts: Gerechnet wird mit dem,
// was auf dem Rüstplan und in der Zeiterfassung steht, nicht mit Zeitpunkten.
//
// Definitionen wie im Vorgaengertool (getBetaWeekSummary):
// - Zuordnung ueber Maschine + Artikel. Gibt es mehrere Ist-Eintraege, nimmt
//   diese Fassung den zeitlich naechsten statt den ersten der Liste.
// - Ausfuehrungsrate = zugeordnete ÷ geplante Umruestungen. Ob in der
//   richtigen Schicht, zaehlt dort nicht, sondern separat als „falsche Schicht".
// - Massgeblich fuer Schicht und Versatz ist das *Ende* der Ist-Ruestung,
//   wenn es erfasst ist, sonst ihr Beginn — die IST-Rüstdatei meldet die
//   Fertigmeldung, nicht immer den Start.
// - Startversatz = Mittel von (Ist − Plan) mit Vorzeichen: Wer mal frueher,
//   mal spaeter ruestet, mittelt sich heraus; die Ampel bewertet die
//   durchschnittliche Verspaetung.
// - Ungeplant = Ist-Eintraege, zu deren Maschine + Artikel gar nichts geplant war.
//
// Positionen ohne Umruestung (Ruesttyp „N") gehoeren nicht in `planned` —
// das filtert der Aufrufer, diese Datei kennt keine Ruesttypen.

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
  /** Fertigmeldung der Ruestung, wenn erfasst. */
  actualEnd?: string
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
  wrongShift: number
  notExecuted: number
  unplanned: number
  /** matched / planned in Prozent; null ohne geplante Umruestung. */
  executionRatePct: number | null
  /** Mittel von (Ist − Plan) in Minuten, mit Vorzeichen, ueber alle zugeordneten. */
  avgStartOffsetMin: number | null
  /** Zuordnung je geplanter Umruestung, fuer die Anzeige in der Tageserfassung. */
  items: {
    id: string
    actualAt: string | null
    offsetMin: number | null
    status: 'executed' | 'wrongShift' | 'notExecuted'
  }[]
}

/** Der Zeitpunkt, an dem eine Ist-Ruestung gemessen wird: Ende, sonst Beginn. */
function measuredAt(a: ActualChangeover): string {
  return a.actualEnd ?? a.actualStart
}

export function executionStats(
  planned: readonly PlannedChangeover[],
  actual: readonly ActualChangeover[],
  shifts: readonly ShiftDefinition[],
): ExecutionStats {
  const used = new Set<number>()

  // Zuerst die zeitlich engsten Paare: sonst nimmt eine frueh geplante Ruestung
  // einer spaeteren den passenden Ist-Eintrag weg.
  const candidates: { p: number; a: number; distance: number }[] = []
  planned.forEach((p, pi) => {
    const pm = wallClockMinutes(p.plannedStart)
    actual.forEach((a, ai) => {
      if (a.machine === p.machine && a.article === p.article) {
        candidates.push({ p: pi, a: ai, distance: Math.abs(wallClockMinutes(measuredAt(a)) - pm) })
      }
    })
  })
  candidates.sort((x, y) => x.distance - y.distance)
  const matchOf = new Map<number, number>()
  for (const c of candidates) {
    if (matchOf.has(c.p) || used.has(c.a)) continue
    matchOf.set(c.p, c.a)
    used.add(c.a)
  }

  let wrongShift = 0
  let offsetSum = 0
  const items: ExecutionStats['items'] = planned.map((p, pi) => {
    const ai = matchOf.get(pi)
    if (ai === undefined) return { id: p.id, actualAt: null, offsetMin: null, status: 'notExecuted' as const }
    const at = measuredAt(actual[ai])
    const offsetMin = wallClockMinutes(at) - wallClockMinutes(p.plannedStart)
    offsetSum += offsetMin
    const plannedShift = shiftAt(p.plannedStart, shifts)
    const actualShift = shiftAt(at, shifts)
    const sameShift =
      plannedShift !== null &&
      actualShift !== null &&
      plannedShift.code === actualShift.code &&
      plannedShift.startDay === actualShift.startDay
    if (!sameShift) wrongShift++
    return { id: p.id, actualAt: at, offsetMin, status: sameShift ? ('executed' as const) : ('wrongShift' as const) }
  })

  // Ungeplant heisst: fuer diese Maschine + Artikel war nichts geplant. Ein
  // zweiter Ist-Eintrag zu einer geplanten Ruestung ist eine Wiederholung,
  // keine ungeplante Ruestung.
  const plannedKeys = new Set(planned.map((p) => `${p.machine}|${p.article}`))
  const unplanned = actual.filter((a) => !plannedKeys.has(`${a.machine}|${a.article}`)).length

  const matched = matchOf.size
  return {
    planned: planned.length,
    matched,
    wrongShift,
    notExecuted: planned.length - matched,
    unplanned,
    executionRatePct: planned.length > 0 ? (matched / planned.length) * 100 : null,
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
