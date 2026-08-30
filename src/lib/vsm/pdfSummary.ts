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

/** Report title line: project name + today's date (Swiss/DACH dd.mm.yyyy convention). */
export function buildPdfTitle(projectName: string, now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${projectName} — Wertstromanalyse (${dd}.${mm}.${yyyy})`
}
