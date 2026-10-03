import { describe, expect, it } from 'vitest'
import { executionStats, findSetupConflicts, shiftAt } from './execution'
import { DEFAULT_SHIFTS } from './settings'

// Vorgabeschichten: Frueh 06–14, Spaet 14–22, Nacht 22–06.
const S = DEFAULT_SHIFTS

describe('shiftAt', () => {
  it('finds the shift a time falls into', () => {
    expect(shiftAt('2026-10-05T06:00', S)).toEqual({ code: 'f', startDay: '2026-10-05' })
    expect(shiftAt('2026-10-05T13:59', S)).toEqual({ code: 'f', startDay: '2026-10-05' })
    expect(shiftAt('2026-10-05T14:00', S)).toEqual({ code: 's', startDay: '2026-10-05' })
  })

  it('assigns early morning to the night shift that started the day before', () => {
    expect(shiftAt('2026-10-06T02:30', S)).toEqual({ code: 'n', startDay: '2026-10-05' })
    expect(shiftAt('2026-10-05T23:00', S)).toEqual({ code: 'n', startDay: '2026-10-05' })
  })
})

describe('executionStats', () => {
  const planned = [
    { id: 'p1', machine: 'M1', article: 'A', plannedStart: '2026-10-05T08:00' },
    { id: 'p2', machine: 'M2', article: 'B', plannedStart: '2026-10-05T15:00' },
    { id: 'p3', machine: 'M3', article: 'C', plannedStart: '2026-10-05T10:00' },
    { id: 'p4', machine: 'M4', article: 'D', plannedStart: '2026-10-05T12:00' },
  ]
  const actual = [
    { machine: 'M1', article: 'A', actualStart: '2026-10-05T08:20' }, // +20
    { machine: 'M2', article: 'B', actualStart: '2026-10-05T22:30' }, // falsche Schicht, +450
    { machine: 'M4', article: 'D', actualStart: '2026-10-05T11:50' }, // −10
    { machine: 'M9', article: 'X', actualStart: '2026-10-05T09:00' }, // ungeplant
  ]

  it('counts a changeover in the wrong shift as executed, but reports it separately', () => {
    const s = executionStats(planned, actual, S)
    expect(s).toMatchObject({ planned: 4, matched: 3, wrongShift: 1, notExecuted: 1, unplanned: 1 })
    expect(s.executionRatePct).toBe(75)
    expect(s.items.map((i) => i.status)).toEqual(['executed', 'wrongShift', 'notExecuted', 'executed'])
  })

  it('averages the start offset with its sign', () => {
    expect(executionStats(planned, actual, S).avgStartOffsetMin).toBeCloseTo((20 + 450 - 10) / 3)
  })

  it('measures at the end of the actual changeover when it is recorded', () => {
    const p = [{ id: 'p', machine: 'M1', article: 'A', plannedStart: '2026-10-05T13:00' }]
    const a = [{ machine: 'M1', article: 'A', actualStart: '2026-10-05T13:10', actualEnd: '2026-10-05T14:20' }]
    const s = executionStats(p, a, S)
    expect(s.avgStartOffsetMin).toBe(80)
    expect(s.wrongShift).toBe(1)
  })

  it('does not count a second actual entry for a planned key as unplanned', () => {
    const p = [{ id: 'p', machine: 'M1', article: 'A', plannedStart: '2026-10-05T08:00' }]
    const a = [
      { machine: 'M1', article: 'A', actualStart: '2026-10-05T08:00' },
      { machine: 'M1', article: 'A', actualStart: '2026-10-05T16:00' },
    ]
    expect(executionStats(p, a, S).unplanned).toBe(0)
  })

  it('matches each actual changeover to the nearest planned one, not the first', () => {
    const twice = [
      { id: 'early', machine: 'M1', article: 'A', plannedStart: '2026-10-05T06:30' },
      { id: 'late', machine: 'M1', article: 'A', plannedStart: '2026-10-05T12:00' },
    ]
    const s = executionStats(twice, [{ machine: 'M1', article: 'A', actualStart: '2026-10-05T11:55' }], S)
    expect(s.items.find((i) => i.id === 'late')?.status).toBe('executed')
    expect(s.items.find((i) => i.id === 'early')?.status).toBe('notExecuted')
  })

  it('has no rate without a plan', () => {
    const s = executionStats([], actual, S)
    expect(s.executionRatePct).toBeNull()
    expect(s.avgStartOffsetMin).toBeNull()
    expect(s.unplanned).toBe(4)
  })
})

describe('findSetupConflicts', () => {
  it('flags overlapping setups beyond the available capacity', () => {
    const conflicts = findSetupConflicts([
      { id: 'a', start: '2026-10-05T08:00', durationMin: 60 },
      { id: 'b', start: '2026-10-05T08:30', durationMin: 60 },
      { id: 'c', start: '2026-10-05T10:00', durationMin: 30 },
    ])
    expect(conflicts).toEqual([{ start: '2026-10-05T08:30', ids: ['a', 'b'] }])
  })

  it('does not count back-to-back setups as a conflict', () => {
    expect(
      findSetupConflicts([
        { id: 'a', start: '2026-10-05T08:00', durationMin: 120 },
        { id: 'b', start: '2026-10-05T10:00', durationMin: 60 },
      ]),
    ).toEqual([])
  })

  it('respects a capacity of two setters', () => {
    const setups = [
      { id: 'a', start: '2026-10-05T08:00', durationMin: 60 },
      { id: 'b', start: '2026-10-05T08:10', durationMin: 60 },
    ]
    expect(findSetupConflicts(setups, 2)).toEqual([])
  })

  it('does not leave a zero-length setup active forever', () => {
    expect(
      findSetupConflicts([
        { id: 'a', start: '2026-10-05T08:00', durationMin: 0 },
        { id: 'b', start: '2026-10-05T09:00', durationMin: 30 },
      ]),
    ).toEqual([])
  })
})
