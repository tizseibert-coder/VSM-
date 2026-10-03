// Tagesplanung — welche Art Datei hochgeladen wurde, erkannt am Inhalt.
//
// Nie am Dateinamen: „Rüstplan KW41 final (2).xlsx" kann ein Schichtplan
// sein. Erkannt wird in dieser Reihenfolge, die erste passende Regel gewinnt:
//
//   1. ein Sheet heisst „Schichtplan"                       → Schichtplan
//   2. die erste nicht leere Zeile beginnt mit dd.mm.yy     → Rüstplan
//   3. erste Spalte im Muster T035-A02 in den ersten 3 Zeilen → Produktionsplan
//   4. sonst                                                → unbekannt
//
// Die Regeln sind die von detectXlsxKind im Vorgaengertool, Zeichen fuer
// Zeichen; nur ein Datum wie 31.02.26 gilt hier nicht mehr als Datum.
//
// Diese Datei kennt keine xlsx-Bibliothek: Sie bekommt Sheet-Namen und die
// ersten Zeilen als Werte. Das Lesen der Datei (SheetJS) ist ein Schritt
// davor und kommt mit dem Import in Phase 2.

import { parseSwissDate } from './dates'

export type FileKind = 'shiftPlan' | 'setupPlan' | 'productionPlan' | 'unknown'

export interface WorkbookPreview {
  sheetNames: readonly string[]
  /** Die ersten Zeilen des ersten Sheets, Zellen als Rohwerte. */
  firstRows: readonly (readonly unknown[])[]
}

export const SHIFT_PLAN_SHEET = 'Schichtplan'
const PRODUCTION_ROWS = 3
const SETUP_DATE = /^\d{2}\.\d{2}\.\d{2}/
const PRODUCTION_CELL = /^T\d{3}-[A-Z]\d{2}$/

export function detectFileKind(preview: WorkbookPreview): FileKind {
  // Exakt der Sheet-Name der Firmenvorlage, wie im Vorgaengertool.
  if (preview.sheetNames.includes(SHIFT_PLAN_SHEET)) return 'shiftPlan'

  const firstData = preview.firstRows.find((row) => row.some((c) => cellText(c) !== ''))
  const first = firstData ? cellText(firstData[0]) : ''
  if (SETUP_DATE.test(first) && parseSwissDate(first) !== null) return 'setupPlan'

  if (preview.firstRows.slice(0, PRODUCTION_ROWS).some((row) => PRODUCTION_CELL.test(cellText(row[0])))) return 'productionPlan'
  return 'unknown'
}

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  return String(cell).trim()
}

export type UploadTarget = 'setupPlan' | 'shiftPlan'

export type UploadCheck =
  | { ok: true }
  /** Die Datei ist eine andere Art als das Upload-Ziel; `detected` sagt, welcher Weg der richtige ist. */
  | { ok: false; reason: 'mismatch'; detected: Exclude<FileKind, 'unknown'> }
  | { ok: false; reason: 'unknown' }

/**
 * Erkannte Art gegen das gewaehlte Upload-Ziel. Bei Abweichung wird das
 * Parsen blockiert — kein Teilergebnis, kein stilles Scheitern.
 */
export function checkUploadTarget(detected: FileKind, target: UploadTarget): UploadCheck {
  if (detected === target) return { ok: true }
  if (detected === 'unknown') return { ok: false, reason: 'unknown' }
  return { ok: false, reason: 'mismatch', detected }
}
