import { describe, expect, it } from 'vitest'
import { generateFactory } from '../fixtures/generator'
import { setupPlanRows, shiftPlanRows } from '../fixtures/files'
import { DEFAULT_SETTINGS } from '../settings'
import { classifySetup, parseSetupPlan } from './setupPlan'
import { excelSerialToIsoDay, parseShiftPlan } from './shiftPlan'
import { hashName, mapPeopleToKuerzel, suggestKuerzel } from './people'

const S = DEFAULT_SETTINGS

describe('parseSetupPlan', () => {
  const block = [
    ['05.10.26'],
    ['05.10.26 06:30 Schicht 1 Frühschicht', '', '', 'Auftrag 4711', '', '', '', 'Vorgänger 4700'],
    ['', 'Maschine', '', 'T030-A01'],
    ['', 'disponiert', '', '', '', '', '', 'bis 05.10.26 06:20'],
    ['', 'Werkzeug', '', 'W-500', '', '', '', 'W-498'],
    ['', 'Artikel', '', '900037', '', '', '', '900000'],
    ['', 'Kurztext', '', 'Deckel', '', '', '', 'Rahmen'],
    ['', 'Material', '', 'MAT-1', '', '', '', 'MAT-2'],
    ['05.10.26 22:15 Schicht 3', '', '', 'Auftrag 4712'],
    ['', 'Maschine', '', 'T031-A02'],
    ['', 'Artikel', '', '900074', '', '', '', '900074'],
    ['', '28 kg', '', 'MAT-3', '', '', '', 'MAT-3'],
  ]

  it('reads one item per block with old and new state', () => {
    const r = parseSetupPlan(block, S)
    expect(r.planDay).toBe('2026-10-05')
    expect(r.incomplete).toBe(0)
    expect(r.items[0]).toEqual({
      order: '4711',
      predecessor: '4700',
      shiftNumber: 1,
      shiftCode: 'f',
      plannedStart: '2026-10-05T06:30',
      machine: 'T030-A01',
      article: '900037',
      articleBefore: '900000',
      description: 'Deckel',
      tool: 'W-500',
      toolBefore: 'W-498',
      material: 'MAT-1',
      materialBefore: 'MAT-2',
      setupType: 'AM',
      setupMinutes: S.setupNorms.AM,
      dispatchedUntil: '05.10.26 06:20',
    })
  })

  it('treats a weight row as the material row and maps Schicht 3 to the third shift', () => {
    const item = parseSetupPlan(block, S).items[1]
    expect(item).toMatchObject({ shiftCode: 'n', plannedStart: '2026-10-05T22:15', material: 'MAT-3', setupType: 'N', setupMinutes: 0 })
  })

  it('counts blocks without machine or article instead of dropping them silently', () => {
    const r = parseSetupPlan([['05.10.26 06:30 Schicht 1'], ['', 'Werkzeug', '', 'W-1']], S)
    expect(r).toEqual({ planDay: '2026-10-05', items: [], incomplete: 1 })
  })

  it('has no plan day for a file without any setup header', () => {
    expect(parseSetupPlan([['Hallo']], S).planDay).toBeNull()
  })
})

describe('classifySetup', () => {
  const base = { article: 'A', articleBefore: 'A', tool: 'W', toolBefore: 'W', material: 'M', materialBefore: 'M' }
  it('distinguishes tool, material and both', () => {
    expect(classifySetup(base)).toBe('N')
    expect(classifySetup({ ...base, toolBefore: 'X' })).toBe('A')
    expect(classifySetup({ ...base, materialBefore: 'X' })).toBe('M')
    expect(classifySetup({ ...base, articleBefore: 'X' })).toBe('M')
    expect(classifySetup({ ...base, toolBefore: 'X', articleBefore: 'X' })).toBe('AM')
  })

  it('does not guess a change without any predecessor data', () => {
    expect(classifySetup({ ...base, articleBefore: '', toolBefore: '', materialBefore: '' })).toBe('N')
  })
})

describe('parseShiftPlan', () => {
  it('converts Excel serial dates without time zone effects', () => {
    expect(excelSerialToIsoDay(46299)).toBe('2026-10-04')
    expect(excelSerialToIsoDay(45658)).toBe('2025-01-01')
    expect(excelSerialToIsoDay(0)).toBeNull()
  })

  it('reads people, weeks and codes from the template layout', () => {
    const rows = [
      ['Schichtplan'],
      [],
      [],
      ['', '', '', 46299, 46300, 46301, '', 46302],
      ['', '', 'Name', 'So', 'Mo', 'Di', 'Kommentar', 'Mi'],
      ['A', '', 'ABC', '', 'f*', 'k', 'egal', 'Fs'],
      ['', 'B', 'DEF', 'n', 'x', 'h', '', ''],
      ['', '', '12'],
      ['', '', 'Frühschicht', 'f'],
    ]
    const r = parseShiftPlan(rows, S)
    expect(r.firstDay).toBe('2026-10-04')
    expect(r.lastDay).toBe('2026-10-07')
    expect(r.people.map((p) => [p.name, p.team])).toEqual([
      ['ABC', 'A'],
      ['DEF', 'B'],
    ])
    // Sterne weg, krank → abwesend, „Fs" → erster Buchstabe f, Kommentar-Spalte ignoriert
    expect(r.people[0].weeks).toEqual([{ sunday: '2026-10-04', codes: [null, 'f', 'a', 'f', null, null, null] }])
    expect(r.people[1].weeks[0].codes.slice(0, 3)).toEqual(['n', null, 'a'])
    expect(r.unknownCodes).toEqual([{ code: 'x', count: 1 }])
  })
})

describe('round trip with the invented factory', () => {
  const f = generateFactory({ seed: 11, days: 5, rosterWeeks: 6 })

  it('reads back every planned setup of a day', () => {
    const day = f.days.find((d) => d.planned.length > 0)!
    const r = parseSetupPlan(setupPlanRows(f, day), f.settings)
    expect(r.planDay).toBe(day.day)
    expect(r.items.map((i) => [i.machine, i.article, i.plannedStart])).toEqual(day.planned.map((p) => [p.machine, p.article, p.plannedStart]))
    expect(r.items[0].setupType).toBe('M')
    expect(new Set(r.items.slice(1).map((i) => i.setupType))).not.toContain('N')
  })

  it('reads back the roster, with absences stored without their reason', () => {
    const r = parseShiftPlan(shiftPlanRows(f), f.settings)
    expect(r.people).toHaveLength(f.people.length)
    expect(r.people[0].weeks).toHaveLength(6)
    const raw = f.people.flatMap((p) => p.weeks.flatMap((w) => w.codes))
    const read = r.people.flatMap((p) => p.weeks.flatMap((w) => w.codes))
    expect(read).not.toContain('k')
    expect(read).not.toContain('h')
    expect(read.filter((c) => c === 'a').length).toBe(raw.filter((c) => c === 'k' || c === 'h').length)
  })
})

describe('names → Kürzel', () => {
  const org = '00000000-0000-0000-0000-000000000001'

  it('recognises a name regardless of spacing and case, but not across organisations', async () => {
    const a = await hashName(org, '  Anna  Muster ')
    expect(a).toBe(await hashName(org, 'anna muster'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(await hashName('00000000-0000-0000-0000-000000000002', 'Anna Muster'))
  })

  it('suggests a free Kürzel without accents', () => {
    expect(suggestKuerzel('Jürg', new Set())).toBe('JUR')
    expect(suggestKuerzel('Jürg', new Set(['JUR']))).toBe('JU2')
    expect(suggestKuerzel('Li', new Set())).toBe('LIX')
  })

  it('maps known names, removes the name and leaves new ones open with a suggestion', async () => {
    const aliases = new Map([[await hashName(org, 'Anna Muster'), 'AMU']])
    const r = await mapPeopleToKuerzel(org, [
      { name: 'Anna Muster', team: 'A' },
      { name: 'Beat Beispiel', team: 'B' },
    ], aliases)
    expect(r.mapped).toEqual([{ team: 'A', kuerzel: 'AMU' }])
    expect(r.unmapped).toEqual([{ name: 'Beat Beispiel', hash: await hashName(org, 'Beat Beispiel'), suggestion: 'BEA' }])
  })
})
