import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseProcessesCsv } from './csvImport'

describe('parseProcessesCsv', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseProcessesCsv('')).toEqual([])
  })

  it('parses name and cycle_time columns', () => {
    const csv = 'name,cycle_time\nDrehen,3.5\nFraesen,2.1'
    expect(parseProcessesCsv(csv)).toEqual([
      { name: 'Drehen', cycleTime: 3.5 },
      { name: 'Fraesen', cycleTime: 2.1 },
    ])
  })

  it('parses optional oee and wip columns when present', () => {
    const csv = 'name,cycle_time,oee,wip\nDrehen,3.5,82,12'
    expect(parseProcessesCsv(csv)).toEqual([
      { name: 'Drehen', cycleTime: 3.5, oee: 82, wip: 12 },
    ])
  })

  it('is case-insensitive and trims header/column whitespace', () => {
    const csv = ' NAME , CYCLE_TIME \n Drehen , 3.5 '
    expect(parseProcessesCsv(csv)).toEqual([{ name: 'Drehen', cycleTime: 3.5 }])
  })

  it('ignores column order and extra unknown columns', () => {
    const csv = 'cycle_time,foo,name\n3.5,ignored,Drehen'
    expect(parseProcessesCsv(csv)).toEqual([{ name: 'Drehen', cycleTime: 3.5 }])
  })

  it('skips blank lines', () => {
    const csv = 'name,cycle_time\nDrehen,3.5\n\nFraesen,2.1\n'
    expect(parseProcessesCsv(csv)).toHaveLength(2)
  })

  it('throws when the name column is missing', () => {
    expect(() => parseProcessesCsv('cycle_time\n3.5')).toThrow(/name/i)
  })

  it('throws when the cycle_time column is missing', () => {
    expect(() => parseProcessesCsv('name\nDrehen')).toThrow(/cycle_time/i)
  })

  it('throws with a row number when a name is empty', () => {
    const csv = 'name,cycle_time\n,3.5'
    expect(() => parseProcessesCsv(csv)).toThrow(/zeile 2/i)
  })

  it('throws with a row number when cycle_time is not a number', () => {
    const csv = 'name,cycle_time\nDrehen,abc'
    expect(() => parseProcessesCsv(csv)).toThrow(/zeile 2/i)
  })

  it('reads the columns the Erhebungsbogen asks for', () => {
    const csv =
      'name,cycle_time,changeover_time,oee,operator_count,wip,wip_after\nDrehen,3.5,15,82,2,4,120'
    expect(parseProcessesCsv(csv)).toEqual([
      {
        name: 'Drehen',
        cycleTime: 3.5,
        changeoverTime: 15,
        oee: 82,
        operatorCount: 2,
        wip: 4,
        wipAfter: 120,
      },
    ])
  })

  // "Ausgelassen" heisst wirklich ausgelassen und nicht 0 — beim Schreiben
  // faellt das Feld dann weg und die Vorgabe der Tabelle gilt. Eine 0 waere
  // bei OEE die Aussage, dass die Station keine Kapazitaet hat.
  it('leaves an empty optional cell out instead of reading it as zero', () => {
    const csv = 'name,cycle_time,oee,changeover_time\nDrehen,3.5,,15'
    const rows = parseProcessesCsv(csv)
    expect(rows[0]).toEqual({ name: 'Drehen', cycleTime: 3.5, changeoverTime: 15 })
    expect('oee' in rows[0]).toBe(false)
  })

  it('keeps an explicit zero, which is an answer', () => {
    const csv = 'name,cycle_time,wip_after\nDrehen,3.5,0'
    expect(parseProcessesCsv(csv)[0].wipAfter).toBe(0)
  })

  it('throws with a row number when an optional column is not a number', () => {
    const csv = 'name,cycle_time,oee\nDrehen,3.5,ganz gut'
    expect(() => parseProcessesCsv(csv)).toThrow(/zeile 2/i)
  })
})

describe('Semikolon-Dateien aus deutschem Excel', () => {
  it('detects the delimiter from the header line', () => {
    expect(detectDelimiter('name;cycle_time;oee')).toBe(';')
    expect(detectDelimiter('name,cycle_time,oee')).toBe(',')
  })

  // Gleichstand und "gar keins" bleiben beim Komma: So sahen die Dateien vor
  // dieser Aenderung aus, und die muessen weiter gelesen werden.
  it('falls back to the comma it always used', () => {
    expect(detectDelimiter('name')).toBe(',')
  })

  it('parses a semicolon file', () => {
    const csv = 'name;cycle_time;oee\nDrehen;3.5;82'
    expect(parseProcessesCsv(csv)).toEqual([{ name: 'Drehen', cycleTime: 3.5, oee: 82 }])
  })

  // In einer Semikolon-Datei ist das Komma frei fuer die Nachkommastelle —
  // und genau so schreibt deutsches Excel eine Zykluszeit.
  it('reads a decimal comma in a semicolon file', () => {
    const csv = 'name;cycle_time\nDrehen;3,5'
    expect(parseProcessesCsv(csv)[0].cycleTime).toBe(3.5)
  })

  it('strips the byte order mark Excel writes', () => {
    const csv = '\ufeffname;cycle_time\nDrehen;3,5'
    expect(parseProcessesCsv(csv)).toEqual([{ name: 'Drehen', cycleTime: 3.5 }])
  })

  // Ein Bogen hat zwoelf Zeilen, ausgefuellt werden selten alle. Der Rest
  // kommt als ";;;" aus dem Tabellenblatt und ist keine Station.
  it('skips the empty rows left over from a spreadsheet', () => {
    const csv = 'name;cycle_time\nDrehen;3,5\n;\n;;\nFraesen;2,1'
    expect(parseProcessesCsv(csv)).toHaveLength(2)
  })
})
