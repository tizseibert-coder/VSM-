// Tagesplanung — Kalendertage als ISO-Text ("2026-10-05").
//
// Alles mit Datumsbezug wird unter dem *Produktionstag* gefuehrt, dem
// Kalendertag 00:00–24:00 — nicht unter dem Plandatum, das in einer Woche mit
// Nachtschicht ab Sonntag 22:00 einen Tag vorlaeuft. Gerechnet wird in UTC:
// Ein Kalendertag ist hier eine Bezeichnung, kein Zeitpunkt, und darf durch
// keine Zeitzone oder Sommerzeit-Umstellung auf den Vortag rutschen.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseIsoDay(day: string): Date {
  const m = ISO_DAY.exec(day)
  if (!m) throw new Error(`Kein ISO-Datum: ${day}`)
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (date.toISOString().slice(0, 10) !== day) throw new Error(`Kein gueltiges Datum: ${day}`)
  return date
}

export function formatIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = parseIsoDay(day)
  date.setUTCDate(date.getUTCDate() + days)
  return formatIsoDay(date)
}

/** Der Produktionstag eines Plans: der Tag nach dem Plandatum. */
export function productionDayForPlanDate(planDay: string): string {
  return addDays(planDay, 1)
}

/** Tage zwischen zwei Kalendertagen, b − a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIsoDay(b).getTime() - parseIsoDay(a).getTime()) / 86_400_000)
}

/** 0 = Sonntag … 6 = Samstag, wie in der Schichtplan-Vorlage (So–Sa). */
export function weekdaySundayFirst(day: string): number {
  return parseIsoDay(day).getUTCDay()
}

/** ISO-Kalenderwoche (Montag als erster Tag, KW 1 enthaelt den 4. Januar). */
export function isoWeek(day: string): { year: number; week: number } {
  const date = parseIsoDay(day)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday + 3)
  const year = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return { year, week }
}

/** "dd.mm.yy" bzw. "dd.mm.yyyy" (SAP-Export) als ISO-Tag, sonst null. */
export function parseSwissDate(text: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:\s|$)/.exec(text.trim())
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  try {
    parseIsoDay(iso)
  } catch {
    return null
  }
  return iso
}
