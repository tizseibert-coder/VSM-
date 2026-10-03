import { describe, expect, it } from 'vitest'
import { checkUploadTarget, detectFileKind } from './fileDetection'
import { buildZip, crc32 } from './fixtures/zipWriter'
import { repairStreamingZip, ZipRepairError } from './zipRepair'

describe('detectFileKind', () => {
  it('recognises a shift plan by its sheet name, whatever the content', () => {
    expect(detectFileKind({ sheetNames: ['Legende', 'Schichtplan'], firstRows: [['05.10.26']] })).toBe('shiftPlan')
  })

  it('recognises a setup plan by a date at the start of the first non-empty row', () => {
    const rows = [[], ['05.10.26 06:00', 'T030-A01', '900037']]
    expect(detectFileKind({ sheetNames: ['Sheet1'], firstRows: rows })).toBe('setupPlan')
  })

  it('does not take a header row for a setup plan, like the previous tool', () => {
    const rows = [['Datum', 'Maschine'], ['05.10.26', 'T030-A01']]
    expect(detectFileKind({ sheetNames: ['Sheet1'], firstRows: rows })).toBe('unknown')
  })

  it('needs the exact sheet name of the template', () => {
    expect(detectFileKind({ sheetNames: ['schichtplan'], firstRows: [] })).toBe('unknown')
  })

  it('recognises a production plan by a T035-A02-style first column in the first three rows', () => {
    const rows = [['Platz', 'Auftrag'], ['T035-A02', '4711']]
    expect(detectFileKind({ sheetNames: ['Sheet1'], firstRows: rows })).toBe('productionPlan')
    const later = [['a'], ['b'], ['c'], ['T035-A02']]
    expect(detectFileKind({ sheetNames: ['Sheet1'], firstRows: later })).toBe('unknown')
  })

  it('prefers the setup plan when the first data row starts with a date', () => {
    const rows = [['05.10.26', 'T035-A02']]
    expect(detectFileKind({ sheetNames: ['Export'], firstRows: rows })).toBe('setupPlan')
  })

  it('says unknown instead of guessing', () => {
    expect(detectFileKind({ sheetNames: ['Tabelle1'], firstRows: [['Hallo', 42]] })).toBe('unknown')
    expect(detectFileKind({ sheetNames: [], firstRows: [] })).toBe('unknown')
  })
})

describe('checkUploadTarget', () => {
  it('blocks a shift plan uploaded as setup plan and names the right way', () => {
    expect(checkUploadTarget('shiftPlan', 'setupPlan')).toEqual({ ok: false, reason: 'mismatch', detected: 'shiftPlan' })
    expect(checkUploadTarget('setupPlan', 'setupPlan')).toEqual({ ok: true })
    expect(checkUploadTarget('unknown', 'shiftPlan')).toEqual({ ok: false, reason: 'unknown' })
  })
})

describe('repairStreamingZip', () => {
  const enc = new TextEncoder()
  const entries = [
    { name: '[Content_Types].xml', data: enc.encode('<Types/>') },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode('<worksheet>05.10.26</worksheet>') },
  ]
  const local = (bytes: Uint8Array, at: number) => {
    const v = new DataView(bytes.buffer, bytes.byteOffset)
    return { crc: v.getUint32(at + 14, true), compressed: v.getUint32(at + 18, true), size: v.getUint32(at + 22, true) }
  }

  it('writes size and CRC from the central directory back into the local headers', () => {
    const zip = buildZip(entries, { streaming: true })
    expect(local(zip, 0)).toEqual({ crc: 0, compressed: 0, size: 0 })

    const { bytes, patched } = repairStreamingZip(zip)
    expect(patched).toBe(2)
    expect(local(bytes, 0)).toEqual({ crc: crc32(entries[0].data), compressed: 8, size: 8 })
    // Zweiter Eintrag: hinter Kopf (30), Name (19), Daten (8) und Data Descriptor (16).
    const second = 30 + 19 + 8 + 16
    expect(local(bytes, second)).toEqual({ crc: crc32(entries[1].data), compressed: 31, size: 31 })
  })

  it('leaves the input untouched and changes nothing else', () => {
    const zip = buildZip(entries, { streaming: true })
    const before = new Uint8Array(zip)
    const { bytes } = repairStreamingZip(zip)
    expect(zip).toEqual(before)
    const differing = [...bytes].filter((b, i) => b !== zip[i]).length
    expect(differing).toBeGreaterThan(0)
    expect(differing).toBeLessThanOrEqual(2 * 12)
  })

  it('reports nothing to do for a regular ZIP', () => {
    const zip = buildZip(entries)
    const { bytes, patched } = repairStreamingZip(zip)
    expect(patched).toBe(0)
    expect(bytes).toEqual(zip)
  })

  it('rejects data that is not a ZIP', () => {
    expect(() => repairStreamingZip(enc.encode('Datum;Maschine'))).toThrow(ZipRepairError)
  })

  it('computes the standard CRC-32', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
  })
})
