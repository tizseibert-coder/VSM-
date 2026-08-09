// Minimal CSV parser for bulk process import. Deliberately hand-rolled
// (no dependency) since the expected input is a simple, well-defined
// column set (name, cycle_time, optional oee/wip) with no quoted commas.

export interface ParsedProcessRow {
  name: string
  cycleTime: number
  oee?: number
  wip?: number
}

const REQUIRED_COLUMNS = ['name', 'cycle_time'] as const

export function parseProcessesCsv(csv: string): ParsedProcessRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  const header = lines[0].split(',').map((col) => col.trim().toLowerCase())

  for (const required of REQUIRED_COLUMNS) {
    if (!header.includes(required)) {
      throw new Error(`CSV muss eine Spalte "${required}" enthalten.`)
    }
  }

  const nameIdx = header.indexOf('name')
  const cycleTimeIdx = header.indexOf('cycle_time')
  const oeeIdx = header.indexOf('oee')
  const wipIdx = header.indexOf('wip')

  return lines.slice(1).map((line, i) => {
    const rowNumber = i + 2 // header is row 1, data starts at row 2
    const cols = line.split(',').map((col) => col.trim())

    const name = cols[nameIdx]
    if (!name) {
      throw new Error(`Zeile ${rowNumber}: "name" fehlt.`)
    }

    const cycleTime = Number(cols[cycleTimeIdx])
    if (Number.isNaN(cycleTime)) {
      throw new Error(`Zeile ${rowNumber}: "cycle_time" ist keine Zahl.`)
    }

    const row: ParsedProcessRow = { name, cycleTime }

    if (oeeIdx !== -1 && cols[oeeIdx]) {
      row.oee = Number(cols[oeeIdx])
    }
    if (wipIdx !== -1 && cols[wipIdx]) {
      row.wip = Number(cols[wipIdx])
    }

    return row
  })
}
