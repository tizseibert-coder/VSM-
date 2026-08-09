import { describe, expect, it } from 'vitest'
import { parseProcessesCsv } from './csvImport'

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
})
