// Tagesplanung — den Schichtplan aus Tabellenzeilen lesen.
//
// Feste Firmenvorlage, Sheet „Schichtplan" (nachgebaut nach
// parseShiftplanXlsx im Vorgaengertool):
//
//   Zeile 3 (0-basiert)  ab Spalte 3 je Tag ein Datum
//   Zeile 4              Wochentag (So–Sa); „Kommentar"-Spalten zaehlen nicht
//   ab Zeile 5           eine Person je Zeile: Spalte 0/1 Team, Spalte 2 Name,
//                        darunter je Tag ein Schichtcode
//
// Codes werden klein geschrieben, Sterne entfernt („f*" → f); ist der ganze
// Text kein Code, aber sein erster Buchstabe, gilt der (wie im Vorgaenger).
// Danach bildet normalizeRosterCode krank/Ferien auf „abwesend" ab — der
// Grund einer Abwesenheit wird nicht gespeichert. Unbekanntes wird gezaehlt
// und gemeldet, die Zelle bleibt leer.
//
// Die Zellen kommen als Rohwerte: Datumszellen als Excel-Seriennummer, so
// haengt nichts an der Zeitzone des Servers.

import { addDays, formatIsoDay, parseSwissDate, weekdaySundayFirst } from '../dates'
import type { PpSettings } from '../settings'
import { countUnknownCodes, normalizeRosterCode, type NormalizedCode } from '../shifts'

export interface ShiftPlanPerson {
  /** Wie in der Datei. Das Werkzeug fuehrt Kuerzel; die Zuordnung Name → Kuerzel passiert beim Speichern. */
  name: string
  team: string
  weeks: { sunday: string; codes: (string | null)[] }[]
}

export interface ShiftPlanResult {
  people: ShiftPlanPerson[]
  firstDay: string | null
  lastDay: string | null
  unknownCodes: { code: string; count: number }[]
}

const DATE_ROW = 3
const DAY_ROW = 4
const FIRST_PERSON_ROW = 5
/** Die Vorlage hat Platz fuer 32 Personen; darunter folgt die Legende. */
const LAST_PERSON_ROW = 36
const FIRST_DAY_COL = 3
const SKIP_NAMES = new Set(['Frühschicht', 'Spätschicht', 'Nachtschicht', 'Feiertag'])

/** Excel zaehlt Tage ab dem 30.12.1899 (mit dem Schaltjahr-1900-Fehler, der hier nicht stoert). */
export function excelSerialToIsoDay(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null
  return formatIsoDay(new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000))
}

function cellToIsoDay(cell: unknown): string | null {
  if (typeof cell === 'number') return excelSerialToIsoDay(cell)
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return formatIsoDay(cell)
  if (typeof cell === 'string') {
    const t = cell.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
    return parseSwissDate(t)
  }
  return null
}

export function parseShiftPlan(
  rows: readonly (readonly unknown[])[],
  settings: Pick<PpSettings, 'shifts' | 'importCodeMap'>,
): ShiftPlanResult {
  const dateRow = rows[DATE_ROW] ?? []
  const dayRow = rows[DAY_ROW] ?? []

  const columns: { col: number; day: string }[] = []
  for (let col = FIRST_DAY_COL; col < dateRow.length; col++) {
    const label = String(dayRow[col] ?? '').trim()
    if (!label || label === 'Kommentar') continue
    const day = cellToIsoDay(dateRow[col])
    if (day) columns.push({ col, day })
  }

  const sundays = [...new Set(columns.map((c) => addDays(c.day, -weekdaySundayFirst(c.day))))].sort()
  const normalized: (NormalizedCode | null)[] = []
  const people: ShiftPlanPerson[] = []

  for (let r = FIRST_PERSON_ROW; r <= Math.min(LAST_PERSON_ROW, rows.length - 1); r++) {
    const row = rows[r] ?? []
    const name = String(row[2] ?? '').trim()
    if (!name || !Number.isNaN(Number(name)) || SKIP_NAMES.has(name)) continue
    const team = String(row[0] || row[1] || '').trim()

    const byDay = new Map<string, string | null>()
    for (const { col, day } of columns) {
      const code = readCode(row[col], settings)
      normalized.push(code)
      byDay.set(day, code?.known ? code.code : null)
    }
    people.push({
      name,
      team,
      weeks: sundays.map((sunday) => ({
        sunday,
        codes: Array.from({ length: 7 }, (_, i) => byDay.get(addDays(sunday, i)) ?? null),
      })),
    })
  }

  const days = columns.map((c) => c.day).sort()
  return { people, firstDay: days[0] ?? null, lastDay: days.at(-1) ?? null, unknownCodes: countUnknownCodes(normalized) }
}

function readCode(cell: unknown, settings: Pick<PpSettings, 'shifts' | 'importCodeMap'>): NormalizedCode | null {
  const text = String(cell ?? '').trim().toLowerCase().replace(/\*/g, '')
  if (!text) return null
  const whole = normalizeRosterCode(text, settings.shifts, settings.importCodeMap)
  if (whole?.known) return whole
  const first = normalizeRosterCode(text[0], settings.shifts, settings.importCodeMap)
  return first?.known ? first : whole
}
