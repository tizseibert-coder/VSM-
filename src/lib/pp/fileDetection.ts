// Tagesplanung — welche Art Datei hochgeladen wurde, erkannt am Inhalt.
//
// Nie am Dateinamen: „Rüstplan KW41 final (2).xlsx" kann ein Schichtplan
// sein. Erkannt wird in dieser Reihenfolge, die erste passende Regel gewinnt:
//
//   1. ein Sheet heisst „Schichtplan"                       → Schichtplan
//   2. die erste Datenzeile beginnt mit dd.mm.yy            → Rüstplan
//   3. Zellen im Muster T035-A02 in den ersten Zeilen       → Produktionsplan
//   4. sonst                                                → unbekannt
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
const SCAN_ROWS = 10
const PRODUCTION_CELL = /^T\d{3}-[A-Z]\d{2}$/

export function detectFileKind(preview: WorkbookPreview): FileKind {
  if (preview.sheetNames.some((n) => n.trim().toLowerCase() === SHIFT_PLAN_SHEET.toLowerCase())) return 'shiftPlan'

  const rows = preview.firstRows.filter((row) => row.some((c) => cellText(c) !== '')).slice(0, SCAN_ROWS)
  // „Erste Datenzeile": SAP-Exporte haben teils eine Kopfzeile mit
  // Spaltennamen davor. Deshalb die erste Zeile, deren erste Zelle nicht leer
  // ist und die keine reine Textzeile ohne Ziffern ist.
  const firstData = rows.find((row) => /\d/.test(row.map(cellText).join('')))
  if (firstData && parseSwissDate(cellText(firstData[0])) !== null) return 'setupPlan'

  if (rows.some((row) => row.some((c) => PRODUCTION_CELL.test(cellText(c))))) return 'productionPlan'
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
