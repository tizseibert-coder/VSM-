// Tagesplanung — Schichtcodes und PV-Stunden je Kalendertag.
//
// Die Nachtschicht ueberspannt Mitternacht. Damit die geplante
// Personalkapazitaet mit der kalendertaeglichen Ist-Auswertung (Zeiterfassung)
// uebereinstimmt, wird sie aufgeteilt: der Teil vor Mitternacht auf den
// Starttag, der Rest auf den Folgetag. Bei 22:00–05:00 sind das 2 h und 5 h.
// Die Aufteilung folgt aus Beginn und Dauer der Schicht in den Einstellungen,
// nicht aus festen Zahlen — ein Werk mit Nacht 22:00–06:00 bekommt 2 h und 6 h.

import { addDays } from './dates'
import type { ShiftDefinition } from './settings'

export interface RosterEntry {
  day: string
  code: string
}

const MINUTES_PER_DAY = 24 * 60

/** Stunden einer Schicht, die auf ihren Starttag bzw. den Folgetag fallen. */
export function splitShiftHours(shift: ShiftDefinition): { startDay: number; nextDay: number } {
  if (shift.kind !== 'work' || shift.hours <= 0) return { startDay: 0, nextDay: 0 }
  if (shift.startMinutes === undefined) return { startDay: shift.hours, nextDay: 0 }
  const beforeMidnight = Math.max(0, MINUTES_PER_DAY - shift.startMinutes) / 60
  const startDay = Math.min(shift.hours, beforeMidnight)
  return { startDay, nextDay: shift.hours - startDay }
}

/**
 * PV-Stunden eines Kalendertags: alle Schichten des Tages mit ihrem Anteil
 * vor Mitternacht plus der Anteil nach Mitternacht aller Schichten des
 * Vortags. Unbekannte Codes zaehlen 0 Stunden — sie werden beim Import
 * gemeldet (normalizeRosterCode), nicht hier still geraten.
 */
export function pvHoursForDay(entries: readonly RosterEntry[], day: string, shifts: readonly ShiftDefinition[]): number {
  const byCode = new Map(shifts.map((s) => [s.code, s]))
  const previous = addDays(day, -1)
  let hours = 0
  for (const entry of entries) {
    const shift = byCode.get(entry.code)
    if (!shift) continue
    const split = splitShiftHours(shift)
    if (entry.day === day) hours += split.startDay
    else if (entry.day === previous) hours += split.nextDay
  }
  return hours
}

export type NormalizedCode = { code: string; known: true } | { code: string; known: false }

/**
 * Ein Code aus der Schichtplan-Datei, wie er gespeichert wird: getrimmt,
 * klein, ueber importCodeMap abgebildet (krank/Ferien → abwesend). Leere
 * Zellen sind kein Code (null). Was danach nicht in den Schichten steht, ist
 * unbekannt — es wird mitgezaehlt und dem Nutzer gemeldet, nicht verworfen.
 */
export function normalizeRosterCode(
  raw: unknown,
  shifts: readonly ShiftDefinition[],
  importCodeMap: Readonly<Record<string, string>>,
): NormalizedCode | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim().toLowerCase()
  if (text === '') return null
  const code = importCodeMap[text] ?? text
  return shifts.some((s) => s.code === code) ? { code, known: true } : { code, known: false }
}

/** Unbekannte Codes mit Anzahl, haeufigste zuerst — fuer die Meldung nach dem Import. */
export function countUnknownCodes(codes: readonly (NormalizedCode | null)[]): { code: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of codes) {
    if (c && !c.known) counts.set(c.code, (counts.get(c.code) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}
