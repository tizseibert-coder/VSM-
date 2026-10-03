import { describe, expect, it } from 'vitest'
import { addDays, isoWeek, parseSwissDate, productionDayForPlanDate } from './dates'
import { countUnknownCodes, normalizeRosterCode, plannedOtHoursForDay, pvHoursForDay, splitShiftHours } from './shifts'
import { DEFAULT_SETTINGS, resolveSettings, type ShiftDefinition } from './settings'

// Ein Werk mit 8.5-h-Tagschichten und einer Nacht 22:00–05:00 — das Muster
// aus dem Konzept, an dem der 2-h/5-h-Split beschrieben ist.
const PLANT: ShiftDefinition[] = [
  { code: 'f', label: 'Früh', kind: 'work', hours: 8.5, startMinutes: 5 * 60 },
  { code: 's', label: 'Spät', kind: 'work', hours: 8.5, startMinutes: 13 * 60 + 30 },
  { code: 'n', label: 'Nacht', kind: 'work', hours: 7, startMinutes: 22 * 60 },
  { code: 't', label: 'Teilzeit', kind: 'work', hours: 4 },
  { code: 'a', label: 'Abwesend', kind: 'absent', hours: 0 },
]

describe('splitShiftHours', () => {
  it('splits a 22:00–05:00 night into 2 h on the start day and 5 h on the next', () => {
    expect(splitShiftHours(PLANT[2])).toEqual({ startDay: 2, nextDay: 5 })
  })

  it('derives the split from the settings, not from fixed numbers', () => {
    expect(splitShiftHours({ code: 'n', label: 'N', kind: 'work', hours: 8, startMinutes: 22 * 60 })).toEqual({ startDay: 2, nextDay: 6 })
  })

  it('keeps day shifts and shifts without a start time on their own day', () => {
    expect(splitShiftHours(PLANT[0])).toEqual({ startDay: 8.5, nextDay: 0 })
    expect(splitShiftHours(PLANT[3])).toEqual({ startDay: 4, nextDay: 0 })
  })

  it('gives absences no hours', () => {
    expect(splitShiftHours(PLANT[4])).toEqual({ startDay: 0, nextDay: 0 })
  })
})

describe('pvHoursForDay', () => {
  it('adds day shifts in full, 2 h per night of the day and 5 h per night of the day before', () => {
    const entries = [
      { day: '2026-10-04', code: 'n' }, // Sonntag-Nacht → 5 h am Montag
      { day: '2026-10-05', code: 'f' },
      { day: '2026-10-05', code: 's' },
      { day: '2026-10-05', code: 'n' }, // → 2 h am Montag
      { day: '2026-10-05', code: 't' },
      { day: '2026-10-05', code: 'a' },
    ]
    expect(pvHoursForDay(entries, '2026-10-05', PLANT)).toBe(8.5 + 8.5 + 2 + 5 + 4)
    expect(pvHoursForDay(entries, '2026-10-04', PLANT)).toBe(2)
    expect(pvHoursForDay(entries, '2026-10-06', PLANT)).toBe(5)
  })

  it('counts unknown codes as zero instead of guessing', () => {
    expect(pvHoursForDay([{ day: '2026-10-05', code: 'x' }], '2026-10-05', PLANT)).toBe(0)
  })
})

describe('plannedOtHoursForDay', () => {
  const roles = [
    { code: 'setter', label: 'Einrichter', weight: 1 },
    { code: 'trainee', label: 'Lernende', weight: 0.5 },
    { code: 'other', label: 'Übrige', weight: 0 },
  ]

  it('weights each hour by the role, with the same night split as PV', () => {
    const entries = [
      { day: '2026-10-05', code: 'f', role: 'setter' },
      { day: '2026-10-05', code: 'f', role: 'trainee' },
      { day: '2026-10-05', code: 'f', role: 'other' },
      { day: '2026-10-04', code: 'n', role: 'setter' },
    ]
    expect(plannedOtHoursForDay(entries, '2026-10-05', PLANT, roles)).toBe(8.5 + 4.25 + 0 + 5)
  })

  it('counts an unknown role as zero and a missing role with the first role', () => {
    const entries = [
      { day: '2026-10-05', code: 'f', role: 'ghost' },
      { day: '2026-10-05', code: 'f' },
    ]
    expect(plannedOtHoursForDay(entries, '2026-10-05', PLANT, roles)).toBe(8.5)
  })
})

describe('normalizeRosterCode', () => {
  const map = DEFAULT_SETTINGS.importCodeMap

  it('stores sick leave and holidays as plain "absent"', () => {
    expect(normalizeRosterCode('k', PLANT, map)).toEqual({ code: 'a', known: true })
    expect(normalizeRosterCode(' H ', PLANT, map)).toEqual({ code: 'a', known: true })
  })

  it('treats empty cells as no code', () => {
    expect(normalizeRosterCode('', PLANT, map)).toBeNull()
    expect(normalizeRosterCode(null, PLANT, map)).toBeNull()
  })

  it('keeps unknown codes and reports them with a count', () => {
    const codes = ['x', 'f', 'x', 'q', null].map((c) => normalizeRosterCode(c, PLANT, map))
    expect(codes[0]).toEqual({ code: 'x', known: false })
    expect(countUnknownCodes(codes)).toEqual([
      { code: 'x', count: 2 },
      { code: 'q', count: 1 },
    ])
  })
})

describe('dates', () => {
  it('puts the production day one day after the plan date', () => {
    expect(productionDayForPlanDate('2026-10-04')).toBe('2026-10-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('does not slip across the daylight saving switch', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('computes ISO calendar weeks', () => {
    expect(isoWeek('2026-10-05')).toEqual({ year: 2026, week: 41 })
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 })
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 })
  })

  it('reads SAP dates as dd.mm.yy and rejects impossible ones', () => {
    expect(parseSwissDate('05.10.26')).toBe('2026-10-05')
    expect(parseSwissDate('5.1.2027 06:00')).toBe('2027-01-05')
    expect(parseSwissDate('31.02.26')).toBeNull()
    expect(parseSwissDate('Datum')).toBeNull()
  })
})

describe('resolveSettings', () => {
  it('fills missing fields from the defaults', () => {
    const s = resolveSettings({ dlpFactor: 0.5, thresholds: { dlp: { green: 1, yellow: -1 } } as never })
    expect(s.dlpFactor).toBe(0.5)
    expect(s.thresholds.dlp).toEqual({ green: 1, yellow: -1 })
    expect(s.thresholds.deviationPct).toEqual(DEFAULT_SETTINGS.thresholds.deviationPct)
    expect(s.shifts).toBe(DEFAULT_SETTINGS.shifts)
  })

  it('has no plant-specific DLP factor by default', () => {
    expect(DEFAULT_SETTINGS.dlpFactor).toBeNull()
    expect(resolveSettings({ dlpFactor: -2 }).dlpFactor).toBeNull()
  })
})
