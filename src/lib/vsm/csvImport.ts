// Minimal CSV parser for bulk process import — der Weg vom Erhebungsbogen in
// den Wertstrom. Bewusst von Hand geschrieben und ohne Abhaengigkeit: Der
// Spaltensatz ist klein und fest, und Felder mit Anfuehrungszeichen kommen aus
// einem Bogen nicht.
//
// Zwei Eigenheiten, ohne die der Weg ueber deutsches Excel nicht funktioniert:
//
//   Trennzeichen   Deutsches Excel schreibt und erwartet Semikolon; eine
//                  Komma-Datei oeffnet es als *eine* Spalte. Gelesen werden
//                  deshalb beide, entschieden anhand der Kopfzeile.
//   Dezimalkomma   In einer Semikolon-Datei ist das Komma frei fuer die
//                  Nachkommastelle: "1,5" ist dort eineinhalb. In einer
//                  Komma-Datei kann es das nicht sein, dort trennt es.
//
// Die Spaltenliste steht hier und nicht in der Vorlage: Der Leser bestimmt,
// was lesbar ist. csvTemplate.ts schreibt die Vorlage aus genau dieser Liste,
// damit Bogen und Import nicht auseinanderlaufen koennen.

/** Ohne diese beiden ist eine Zeile keine Station. */
export const REQUIRED_COLUMNS = ['name', 'cycle_time'] as const

/**
 * Was zusaetzlich gelesen wird, in der Reihenfolge des Bogens.
 *
 * `wip` und `wip_after` sind mit Absicht zwei Spalten und keine umgedeutete:
 * `wip` ist der Bestand *an* der Station, `wip_after` der Puffer *hinter* ihr.
 * Beides gibt es wirklich, beides zaehlt in calculateKpis mit, und der Bogen
 * fragt das zweite ab. Sie zu verschmelzen hiesse, zwei Dinge unter einem
 * Namen zu fuehren.
 */
export const OPTIONAL_COLUMNS = [
  'changeover_time',
  'oee',
  'operator_count',
  'wip',
  'wip_after',
] as const

export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS] as const

export interface ParsedProcessRow {
  name: string
  cycleTime: number
  changeoverTime?: number
  oee?: number
  operatorCount?: number
  /** Bestand *an* dieser Station. */
  wip?: number
  /** Bestand im Puffer *hinter* dieser Station. */
  wipAfter?: number
}

/**
 * Welches Zeichen die Spalten trennt.
 *
 * Entschieden an der Kopfzeile, nicht an der ganzen Datei: Dort stehen nur
 * Spaltennamen, also keine Dezimalkommas, die die Zaehlung verfaelschen
 * koennten. Gleichstand und "gar keins" bedeuten Komma — das ist die Form, in
 * der die Dateien vor dieser Aenderung geschrieben wurden.
 */
export function detectDelimiter(headerLine: string): ';' | ',' {
  const semicolons = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

/**
 * Ein Feld als Zahl. Bei Semikolon-Dateien gilt das Komma als Dezimalzeichen,
 * bei Komma-Dateien kann es das nicht sein.
 */
function toNumber(raw: string, delimiter: ';' | ','): number {
  return Number(delimiter === ';' ? raw.replace(',', '.') : raw)
}

export function parseProcessesCsv(csv: string): ParsedProcessRow[] {
  const lines = csv
    // Excel stellt eine BOM voran, damit es die Datei selbst wieder als UTF-8
    // erkennt. Bliebe sie stehen, hiesse die erste Spalte nicht "name".
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const header = lines[0].split(delimiter).map((col) => col.trim().toLowerCase())

  for (const required of REQUIRED_COLUMNS) {
    if (!header.includes(required)) {
      throw new Error(`CSV muss eine Spalte "${required}" enthalten.`)
    }
  }

  const idx = (column: string) => header.indexOf(column)
  const nameIdx = idx('name')
  const cycleTimeIdx = idx('cycle_time')

  const rows: ParsedProcessRow[] = []

  lines.slice(1).forEach((line, i) => {
    const rowNumber = i + 2 // header is row 1, data starts at row 2
    const cols = line.split(delimiter).map((col) => col.trim())

    // Eine Zeile aus lauter leeren Zellen ist keine Station, sondern der Rest
    // eines Tabellenblatts. Sie zu bemaengeln wuerde jeden Bogen abweisen, der
    // nicht bis zur letzten der zwoelf Zeilen ausgefuellt wurde.
    if (cols.every((col) => col === '')) return

    const name = cols[nameIdx]
    if (!name) {
      throw new Error(`Zeile ${rowNumber}: "name" fehlt.`)
    }

    const cycleTime = toNumber(cols[cycleTimeIdx] ?? '', delimiter)
    if (Number.isNaN(cycleTime)) {
      throw new Error(`Zeile ${rowNumber}: "cycle_time" ist keine Zahl.`)
    }

    // Eine leere Zelle wird ausgelassen, nicht als 0 gelesen: Beim Schreiben
    // faellt sie dann ganz weg, und es gilt die Vorgabe der Tabelle. Eine 0
    // waere dagegen eine Aussage — bei OEE sogar die, dass die Station keine
    // Kapazitaet hat.
    const optional: Partial<Omit<ParsedProcessRow, 'name' | 'cycleTime'>> = {}
    const OPTIONAL_FIELDS = [
      ['changeover_time', 'changeoverTime'],
      ['oee', 'oee'],
      ['operator_count', 'operatorCount'],
      ['wip', 'wip'],
      ['wip_after', 'wipAfter'],
    ] as const

    for (const [column, field] of OPTIONAL_FIELDS) {
      const at = idx(column)
      if (at === -1 || !cols[at]) continue
      const value = toNumber(cols[at], delimiter)
      if (Number.isNaN(value)) {
        throw new Error(`Zeile ${rowNumber}: "${column}" ist keine Zahl.`)
      }
      optional[field] = value
    }

    rows.push({ name, cycleTime, ...optional })
  })

  return rows
}
