// PDF-Export v1 (Phase 8): pure text-building for the KPI summary block that
// goes under the canvas snapshot image in the exported PDF. Kept separate
// from the actual jsPDF/Konva glue (in VSMCanvas.tsx) because that part is
// side-effecting (touches the DOM/Blob/download) and not meaningfully
// unit-testable — this piece, the actual content, is pure and is.

export interface PdfKpiInput {
  totalLeadTimeDays: number | null
  totalCycleTimeMinutes: number
  valueAddedRatioPercent: number | null
  taktTimeMinutes: number | null
}

/** One line per KPI, in the same order as the on-screen KPI bar. '–' for values that aren't computable yet (no takt/throughput set), matching the KPI bar's own placeholder. */
export function buildKpiSummaryLines(kpis: PdfKpiInput): string[] {
  return [
    `Bearbeitungszeit: ${kpis.totalCycleTimeMinutes.toFixed(1)} min`,
    `Durchlaufzeit: ${kpis.totalLeadTimeDays !== null && kpis.totalLeadTimeDays > 0 ? `${kpis.totalLeadTimeDays.toFixed(1)} Tage` : '–'}`,
    `Wertschöpfungsanteil: ${kpis.valueAddedRatioPercent !== null ? `${kpis.valueAddedRatioPercent.toFixed(2)} %` : '–'}`,
    `Taktzeit: ${kpis.taktTimeMinutes !== null ? `${kpis.taktTimeMinutes.toFixed(1)} min` : '–'}`,
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
 */
export function buildPdfTitle(projectName: string): string {
  return projectName.trim() || 'Wertstromanalyse'
}

/** dd.mm.yyyy — die im DACH-Raum erwartete Schreibweise. */
function formatDate(now: Date): string {
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${now.getFullYear()}`
}

/**
 * Benennt den abgebildeten Zustand.
 *
 * Ein Ausdruck ohne diese Angabe ist im Lenkungsgremium wertlos: Niemand kann
 * unterscheiden, ob er die Messung oder einen Verbesserungsvorschlag in der
 * Hand hält — und genau darauf beruht die Entscheidung, die dort fällt.
 */
export function buildPdfSubtitle(scenarioName: string | null): string {
  const trimmed = scenarioName?.trim()
  return trimmed ? `Future State: ${trimmed}` : 'Ist-Zustand'
}

/** Fusszeile: sagt, woraus das Blatt stammt und wann es gezogen wurde. */
export function buildPdfFooterLine(now: Date = new Date()): string {
  return `Erstellt mit VSM Builder am ${formatDate(now)}`
}
