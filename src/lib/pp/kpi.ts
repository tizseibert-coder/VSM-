// Tagesplanung — Kennzahlen und Ampeln.
//
// UT = Maschinenlaufzeit, OT = Auftragszeit (Personalstunden aus der
// Zeiterfassung), beide in Stunden.
//
//   DLP  = UT × f − OT        (f: Personalstunden je Maschinenstunde)
//   Kmix = UT / OT
//
// Beide haengen an derselben Zahl: DLP = 0 genau bei Kmix = 1 / f. Deshalb
// gibt es nur *einen* Werkswert in den Einstellungen (dlpFactor); das
// Kmix-Ziel wird daraus abgeleitet und nie separat gepflegt — zwei Felder
// liefen auseinander.

import type { Band, PpSettings } from './settings'

export type Ampel = 'green' | 'yellow' | 'red'

export function calcDlp(ut: number, ot: number, factor: number): number {
  return ut * factor - ot
}

/** null statt Infinity, wenn keine OT erfasst ist — ohne Personal gibt es kein Verhaeltnis. */
export function calcKmix(ut: number, ot: number): number | null {
  return ot > 0 ? ut / ot : null
}

/** Ab so vielen Tagen mit Kmix gilt der eigene Ausgangswert als belastbar. */
export const BASELINE_DAYS = 10

export type KmixTarget =
  | { target: number; source: 'factor' }
  | { target: number; source: 'baseline'; days: number }
  | { target: null; source: 'pending'; daysMissing: number }

/**
 * Das Kmix-Ziel einer Organisation. Mit festgelegtem Faktor ist es 1 / f.
 * Ohne Faktor — der Normalfall eines KMU, das seine Kostensaetze nicht in
 * diese Form gebracht hat — ist es der Median der ersten BASELINE_DAYS Tage:
 * der eigene Ausgangswert, den man danach bewusst anhebt. Median statt
 * Mittel, weil ein einziger Stillstandstag in den ersten zehn den
 * Ausgangswert sonst dauerhaft nach unten zieht.
 *
 * `history` in zeitlicher Reihenfolge; Tage ohne Kmix (keine OT) zaehlen nicht.
 */
export function resolveKmixTarget(settings: Pick<PpSettings, 'dlpFactor'>, history: readonly (number | null)[]): KmixTarget {
  if (settings.dlpFactor && settings.dlpFactor > 0) return { target: 1 / settings.dlpFactor, source: 'factor' }
  const first = history.filter((v): v is number => v !== null && Number.isFinite(v)).slice(0, BASELINE_DAYS)
  if (first.length < BASELINE_DAYS) return { target: null, source: 'pending', daysMissing: BASELINE_DAYS - first.length }
  return { target: median(first), source: 'baseline', days: first.length }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('Median einer leeren Liste')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * UT-Ersatzwert fuer Werke ohne Betriebsstundenzaehler-Auswertung: Schuesse ×
 * Zykluszeit. Ein Schuss liefert so viele Teile, wie das Werkzeug Kavitaeten
 * hat. Schlechtteile kosten dieselbe Maschinenzeit wie Gutteile und zaehlen
 * deshalb mit, wenn sie erfasst sind.
 */
export function estimateUtHours(input: {
  goodParts: number
  badParts?: number
  cycleTimeSeconds: number
  cavities: number
}): number {
  const parts = input.goodParts + (input.badParts ?? 0)
  if (parts <= 0 || input.cycleTimeSeconds <= 0 || input.cavities <= 0) return 0
  return ((parts / input.cavities) * input.cycleTimeSeconds) / 3600
}

/** Abweichung Ist gegen Soll in Prozent des Solls; null ohne Soll. */
export function deviationPct(soll: number | null, ist: number | null): number | null {
  if (soll === null || ist === null || soll === 0) return null
  return ((ist - soll) / soll) * 100
}

/** Der Schwellenwert selbst gehoert noch zur besseren Farbe (wie bei der CAMA-Ampel). */
export function rateHigherIsBetter(value: number | null, band: Band): Ampel | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value >= band.green) return 'green'
  if (value >= band.yellow) return 'yellow'
  return 'red'
}

export function rateLowerIsBetter(value: number | null, band: Band): Ampel | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value <= band.green) return 'green'
  if (value <= band.yellow) return 'yellow'
  return 'red'
}

/** Abweichungen bewertet das Konzept nach Betrag: 5 % zu viel ist so gelb wie 5 % zu wenig. */
export function rateDeviation(pct: number | null, band: Band): Ampel | null {
  return rateLowerIsBetter(pct === null ? null : Math.abs(pct), band)
}

export function rateKmix(kmix: number | null, target: number | null, band: Band): Ampel | null {
  if (kmix === null || target === null || target <= 0) return null
  return rateHigherIsBetter(kmix / target, band)
}

export interface KpiRow {
  key: 'pvHours' | 'ut' | 'ot' | 'dlp' | 'kmix' | 'executionRate' | 'startOffset' | 'unplanned'
  soll: number | null
  ist: number | null
  delta: number | null
  ampel: Ampel | null
}

/** Die Zeile „Name · Soll · Ist · Δ · Ampel", gleich fuer Tag und Woche. */
export function kpiRow(key: KpiRow['key'], soll: number | null, ist: number | null, ampel: Ampel | null): KpiRow {
  return { key, soll, ist, delta: soll !== null && ist !== null ? ist - soll : null, ampel }
}
