// Die Zeilen der Szenarien-Vergleichstabelle — eine Kennzahl je Zeile, ein
// Zustand je Spalte, alles schon in der Sprache des Lesers formatiert.
//
// [Bedienbarkeitspruefung 2026-09-03, B16] Die Tabelle stand nur auf der
// Vergleichsseite. Das PDF, das man dem Inhaber dalaesst, zeigte den
// Wertstrom und seine Kennzahlen, aber nicht, was das Szenario daran
// aendert — also ausgerechnet die Seite, wegen der er zustimmt oder nicht.
// Damit Blatt und Bildschirm nicht auseinanderlaufen koennen, baut beides
// jetzt dieselbe Funktion; sie ist rein und deshalb pruefbar, waehrend die
// jsPDF- und die JSX-Seite es nicht sind.

import type { ComparisonRow } from './scenarioComparison'
import { releasedCapital, tiedUpCapital } from './capital'

export interface ComparisonMetricLabels {
  processes: string
  cycleTimeSum: string
  leadTime: string
  pce: string
  taktTime: string
  tiedUpCapital: string
  releasedCapital: string
  unitMin: string
  unitDays: string
  unitPercent: string
}

export interface ComparisonMetricFormatters {
  /** Dezimalzahl in der Sprache des Lesers. */
  num: (value: number, digits?: number) => string
  /** Geldbetrag samt Waehrung des Projekts. */
  money: (value: number) => string
}

export interface ComparisonMetric {
  label: string
  /** Ein Eintrag je Zustand, in der Reihenfolge der uebergebenen Zeilen. */
  values: string[]
}

/** Steht ueberall, wo eine Kennzahl (noch) nicht berechenbar ist. */
export const COMPARISON_EMPTY = '–'

/**
 * Baut die Tabelle.
 *
 * `pieceValue` ist der Wert je Stueck aus dem Projekt; ohne ihn bleiben die
 * beiden Geldzeilen leer statt eine Zahl zu erfinden. Der Ist-Zustand muss
 * die erste Zeile sein — er ist der Massstab, gegen den "freigesetztes
 * Kapital" gerechnet wird.
 */
export function buildComparisonMetrics(
  rows: ComparisonRow[],
  labels: ComparisonMetricLabels,
  format: ComparisonMetricFormatters,
  pieceValue: number | null
): ComparisonMetric[] {
  const capitalOf = (row: ComparisonRow) => tiedUpCapital(row.totalWipCount, pieceValue)
  const currentCapital = rows.length > 0 ? capitalOf(rows[0]) : null

  const metric = (label: string, format: (row: ComparisonRow) => string): ComparisonMetric => ({
    label,
    values: rows.map(format),
  })

  return [
    metric(labels.processes, (r) => String(r.processCount)),
    metric(
      labels.cycleTimeSum,
      (r) => `${format.num(r.totalCycleTimeMinutes)} ${labels.unitMin}`
    ),
    metric(labels.leadTime, (r) =>
      r.totalLeadTimeDays !== null && r.totalLeadTimeDays > 0
        ? `${format.num(r.totalLeadTimeDays)} ${labels.unitDays}`
        : COMPARISON_EMPTY
    ),
    metric(labels.pce, (r) =>
      r.valueAddedRatioPercent !== null
        ? `${format.num(r.valueAddedRatioPercent, 2)} ${labels.unitPercent}`
        : COMPARISON_EMPTY
    ),
    metric(labels.taktTime, (r) =>
      r.taktTimeMinutes !== null
        ? `${format.num(r.taktTimeMinutes)} ${labels.unitMin}`
        : COMPARISON_EMPTY
    ),
    metric(labels.tiedUpCapital, (r) => {
      const capital = capitalOf(r)
      return capital !== null ? format.money(capital) : COMPARISON_EMPTY
    }),
    metric(labels.releasedCapital, (r) => {
      // Im Ist-Zustand gibt es nichts freizusetzen — er ist der Massstab.
      if (r.id === null) return COMPARISON_EMPTY
      const released = releasedCapital(currentCapital, capitalOf(r))
      if (released === null) return COMPARISON_EMPTY
      // Das Vorzeichen ausgeschrieben: Ein Szenario, das Bestand aufbaut
      // (Supermarkt vor dem Schrittmacher), soll das auch so zeigen.
      return released > 0
        ? `+ ${format.money(released)}`
        : released < 0
          ? `− ${format.money(-released)}`
          : format.money(0)
    }),
  ]
}
