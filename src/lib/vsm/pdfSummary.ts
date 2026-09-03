// PDF-Export v1 (Phase 8): pure text-building for the KPI summary block that
// goes under the canvas snapshot image in the exported PDF. Kept separate
// from the actual jsPDF/Konva glue (in VSMCanvas.tsx) because that part is
// side-effecting (touches the DOM/Blob/download) and not meaningfully
// unit-testable — this piece, the actual content, is pure and is.
//
// Seit der Mehrsprachigkeit kommen die Beschriftungen als Parameter herein,
// statt hier als deutsche Zeichenketten zu stehen. Die Funktionen bleiben
// damit rein und testbar; die Sprache kennt nur der Aufrufer, der ohnehin im
// React-Baum haengt und uebersetzen kann.

import { formatDecimal } from './numberFormat'

export interface PdfKpiInput {
  totalLeadTimeDays: number | null
  totalCycleTimeMinutes: number
  valueAddedRatioPercent: number | null
  taktTimeMinutes: number | null
  /**
   * Schon fertig formatiert (Betrag samt Waehrung) oder null, wenn kein Wert
   * je Stueck hinterlegt ist. Die Formatierung haengt an Sprache und Waehrung
   * des Projekts und gehoert deshalb nicht hierher, sondern dorthin, wo beides
   * bekannt ist.
   */
  tiedUpCapital?: string | null
}

/** Beschriftungen und Einheiten fuer den Kennzahlenblock. */
export interface PdfKpiLabels {
  cycleTimeSum: string
  leadTime: string
  pce: string
  taktTime: string
  tiedUpCapital: string
  unitMin: string
  unitDays: string
  unitPercent: string
}

/**
 * One line per KPI, in the same order as the on-screen KPI bar. '–' for
 * values that aren't computable yet (no takt/throughput set), matching the
 * KPI bar's own placeholder.
 */
/**
 * @param locale Sprache des Lesers. Das Blatt geht ins Gremium; "84.5 Tage"
 *   liest ein deutscher Fertigungsleiter als Tippfehler.
 */
export function buildKpiSummaryLines(
  kpis: PdfKpiInput,
  labels: PdfKpiLabels,
  locale: string
): string[] {
  const num = (value: number, digits = 1) => formatDecimal(value, locale, digits)
  return [
    `${labels.cycleTimeSum}: ${num(kpis.totalCycleTimeMinutes)} ${labels.unitMin}`,
    `${labels.leadTime}: ${
      kpis.totalLeadTimeDays !== null && kpis.totalLeadTimeDays > 0
        ? `${num(kpis.totalLeadTimeDays)} ${labels.unitDays}`
        : '–'
    }`,
    `${labels.pce}: ${
      kpis.valueAddedRatioPercent !== null
        ? `${num(kpis.valueAddedRatioPercent, 2)} ${labels.unitPercent}`
        : '–'
    }`,
    `${labels.taktTime}: ${
      kpis.taktTimeMinutes !== null ? `${num(kpis.taktTimeMinutes)} ${labels.unitMin}` : '–'
    }`,
    // Die eine Zeile auf dem Blatt, die auch jemand liest, der mit Taktzeit
    // nichts anfangen kann. Sie faellt weg statt "–" zu zeigen, wenn kein
    // Stueckwert hinterlegt ist: ein leerer Geldbetrag im Gremium wirft mehr
    // Fragen auf, als er beantwortet.
    ...(kpis.tiedUpCapital ? [`${labels.tiedUpCapital}: ${kpis.tiedUpCapital}`] : []),
  ]
}

/**
 * Titelzeile des Blatts: der Projektname, sonst nichts.
 *
 * Frueher hing "— Wertstromanalyse (dd.mm.yyyy)" daran. Seit das Blatt eine
 * Kopf- und eine Fusszeile hat, ist beides doppelt: Die Wortmarke oben und das
 * Diagramm selbst sagen, um welche Art Dokument es geht, und das Datum steht
 * in der Fusszeile. Bei einem Projekt namens "Beispiel: Wertstromanalyse
 * Dreherei" stand das Wort dadurch zweimal in derselben Zeile.
 *
 * `fallback` greift nur, wenn das Projekt gar keinen Namen traegt.
 */
export function buildPdfTitle(projectName: string, fallback: string): string {
  return projectName.trim() || fallback
}

/**
 * Benennt den abgebildeten Zustand.
 *
 * Ein Ausdruck ohne diese Angabe ist im Lenkungsgremium wertlos: Niemand kann
 * unterscheiden, ob er die Messung oder einen Verbesserungsvorschlag in der
 * Hand haelt — und genau darauf beruht die Entscheidung, die dort faellt.
 */
export function buildPdfSubtitle(
  scenarioName: string | null,
  labels: { currentState: string; futureState: (name: string) => string }
): string {
  const trimmed = scenarioName?.trim()
  return trimmed ? labels.futureState(trimmed) : labels.currentState
}
