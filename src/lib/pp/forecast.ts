// Tagesplanung — UT-Prognose und ihr Konfidenzniveau.
//
// Konfidenz (aus dem Konzept): 60 % Datenmenge, 40 % Streuung.
//   Datenmenge: Wurzelkurve, volle Wirkung ab FULL_EFFECT_DAYS Tagen, genutzt
//               werden hoechstens die letzten MAX_DAYS Tage.
//   Streuung:   max(0, 1 − 2 × Variationskoeffizient), Standardabweichung
//               ueber alle Werte (/n) — beides wie computeForecast im
//               Vorgaengertool.
//
// Prognose ohne Kaltstart: Das Vorgaengertool nimmt die Plan-UT unveraendert
// als Prognose und vermerkt im Code, dass der bessere Weg der
// Realisierungsgrad Ist-UT ÷ Plan-UT waere, sobald die Plan-UT mitgespeichert
// wird. Das tut diese Fassung: Ohne Historie ist der Realisierungsgrad 1 (die
// Prognose ist die Plan-UT, wie bisher), mit jedem Tag gewinnt die eigene
// Historie an Gewicht, und zwar mit demselben Datenmengen-Anteil wie oben —
// eine Kurve, nicht zwei. Die Streuung misst dann den Realisierungsgrad statt
// der rohen Tages-UT, die schon deshalb schwankt, weil unterschiedlich viele
// Maschinen laufen.

export const FULL_EFFECT_DAYS = 30
export const MAX_DAYS = 60
/** Ab so vielen Tagen zeigt die Oberflaeche die Prognose als eigene Stufe an. */
export const FORECAST_MIN_DAYS = 5

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function dataAmountScore(days: number): number {
  if (days <= 0) return 0
  return Math.sqrt(Math.min(days, FULL_EFFECT_DAYS) / FULL_EFFECT_DAYS)
}

export function dispersionScore(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean <= 0) return 0
  const cv = standardDeviation(values) / mean
  return Math.min(1, Math.max(0, 1 - 2 * cv))
}

/** Standardabweichung ueber alle Werte (geteilt durch n, nicht n − 1), wie im Vorgaengertool. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
}

export function confidenceLevel(percent: number): ConfidenceLevel {
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'medium'
  return 'low'
}

export interface Confidence {
  percent: number
  level: ConfidenceLevel
  daysUsed: number
}

/** `values` in zeitlicher Reihenfolge; genutzt werden die letzten MAX_DAYS. */
export function calcConfidence(values: readonly number[]): Confidence {
  const used = values.slice(-MAX_DAYS)
  const percent = Math.round((0.6 * dataAmountScore(used.length) + 0.4 * dispersionScore(used)) * 100)
  return { percent, level: confidenceLevel(percent), daysUsed: used.length }
}

export interface UtHistoryDay {
  utActual: number
  /** Vorgabe-UT des Tages aus dem Plan (Zykluszeit × Menge); null, wenn keine Vorgabe vorlag. */
  utPlanned: number | null
}

export type UtForecast =
  | { value: number; basis: 'blended'; realization: number; historyWeight: number; confidence: Confidence }
  | { value: number; basis: 'history-only'; confidence: Confidence }
  | { value: null; basis: 'none'; confidence: Confidence }

/**
 * Prognose der UT fuer einen Tag mit Vorgabe `utPlanned`.
 *
 * - Mit Vorgabe: Vorgabe × gewichteter Realisierungsgrad.
 * - Ohne Vorgabe (keine Zykluszeiten hinterlegt): Mittel der Ist-UT.
 * - Ohne beides: keine Prognose — eine erfundene Zahl waere schlimmer als keine.
 */
export function forecastUt(utPlanned: number | null, history: readonly UtHistoryDay[]): UtForecast {
  const used = history.slice(-MAX_DAYS)
  const ratios = used
    .filter((d) => d.utPlanned !== null && d.utPlanned > 0)
    .map((d) => d.utActual / (d.utPlanned as number))

  if (utPlanned !== null && utPlanned > 0) {
    const confidence = calcConfidence(ratios)
    const historyWeight = dataAmountScore(ratios.length)
    const historyMean = ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 1
    const realization = historyWeight * historyMean + (1 - historyWeight) * 1
    return { value: utPlanned * realization, basis: 'blended', realization, historyWeight, confidence }
  }

  const actuals = used.map((d) => d.utActual)
  const confidence = calcConfidence(actuals)
  if (actuals.length === 0) return { value: null, basis: 'none', confidence }
  return { value: actuals.reduce((s, v) => s + v, 0) / actuals.length, basis: 'history-only', confidence }
}

export interface DlpForecast {
  value: number
  /** DLP bei einer Standardabweichung weniger bzw. mehr UT — die Bandbreite der Prognosekarte. */
  low: number
  high: number
}

/**
 * DLP-Prognose: Prognose-UT × f − geplante OT, mit Bandbreite ±σ der UT.
 * σ ist die Streuung des Realisierungsgrads, umgerechnet auf die Plan-UT
 * dieses Tages; ohne Plan-UT die Streuung der Ist-UT selbst.
 */
export function forecastDlp(
  ut: UtForecast,
  utPlanned: number | null,
  history: readonly UtHistoryDay[],
  plannedOt: number,
  factor: number,
): DlpForecast | null {
  if (ut.value === null) return null
  const used = history.slice(-MAX_DAYS)
  const sigma =
    ut.basis === 'blended'
      ? standardDeviation(used.filter((d) => d.utPlanned !== null && d.utPlanned > 0).map((d) => d.utActual / (d.utPlanned as number))) *
        (utPlanned ?? 0)
      : standardDeviation(used.map((d) => d.utActual))
  const at = (u: number) => u * factor - plannedOt
  return { value: at(ut.value), low: at(ut.value - sigma), high: at(ut.value + sigma) }
}
