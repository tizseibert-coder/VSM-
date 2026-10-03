// Tagesplanung — UT-Prognose und ihr Konfidenzniveau.
//
// Konfidenz (aus dem Konzept): 60 % Datenmenge, 40 % Streuung.
//   Datenmenge: Wurzelkurve, volle Wirkung ab FULL_EFFECT_DAYS Tagen, genutzt
//               werden hoechstens die letzten MAX_DAYS Tage.
//   Streuung:   1 − Variationskoeffizient der genutzten Werte, auf 0..1
//               begrenzt. [Annahme — das Konzept nennt die Gewichtung, nicht
//               die Abbildung der Streuung auf 0..1. Gegen das HTML-Tool
//               pruefen.]
//
// Prognose ohne Kaltstart: Gerechnet wird mit dem Realisierungsgrad
// Ist-UT ÷ Vorgabe-UT der vergangenen Tage, nicht mit der UT selbst — die
// haengt davon ab, wie viele Maschinen an einem Tag laufen, der
// Realisierungsgrad nicht. Ohne Historie ist er 1 (die Vorgabe gilt), mit
// jedem Tag gewinnt die eigene Historie an Gewicht, und zwar mit demselben
// Datenmengen-Anteil wie oben: eine Kurve, nicht zwei.
// [Annahme — gegen das HTML-Tool pruefen.]

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
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  const cv = Math.sqrt(variance) / mean
  return Math.min(1, Math.max(0, 1 - cv))
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
