import { describe, expect, it } from 'vitest'
import { runActionEngine, type DayMetrics } from './actionEngine'
import { addDays } from './dates'
import { assessMaturity } from './maturity'
import { DEFAULT_SETTINGS } from './settings'

const CFG = DEFAULT_SETTINGS.actionEngine
const TODAY = '2026-10-16'

function days(values: Partial<DayMetrics>[]): DayMetrics[] {
  return values.map((v, i) => ({
    day: addDays(TODAY, i - values.length + 1),
    otPlan: null,
    otActual: null,
    executionRatePct: null,
    wrongShift: null,
    ...v,
  }))
}

describe('runActionEngine', () => {
  it('waits while a rule has fewer days than it needs', () => {
    const r = runActionEngine(days([{ otPlan: 100, otActual: 110 }, { otPlan: 100, otActual: 110 }]), TODAY, CFG)
    expect(r.suggestions).toEqual([])
    expect(r.pending).toContainEqual({ ruleId: 'otDeviation', daysWithData: 2, daysMissing: 1 })
    expect(r.pending.map((p) => p.ruleId)).toEqual(['otDeviation', 'executionRate', 'wrongShift'])
  })

  it('flags OT over plan on three data days in a row (D1)', () => {
    const r = runActionEngine(
      days([
        { otPlan: 100, otActual: 101 },
        { otPlan: 100, otActual: 104 },
        { otPlan: 100, otActual: 105 },
        { otPlan: 100, otActual: 103 },
      ]),
      TODAY,
      CFG,
    )
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0]).toMatchObject({ ruleId: 'otDeviation', dimension: 'd1', direction: 'over', severity: 'medium' })
    expect(r.suggestions[0].days).toHaveLength(3)
    expect(r.suggestions[0].value).toBeCloseTo(4)
  })

  it('does not treat scattered deviations as a run', () => {
    const r = runActionEngine(
      days([
        { otPlan: 100, otActual: 105 },
        { otPlan: 100, otActual: 100 },
        { otPlan: 100, otActual: 105 },
        { otPlan: 100, otActual: 100 },
        { otPlan: 100, otActual: 105 },
      ]),
      TODAY,
      CFG,
    )
    expect(r.suggestions.filter((s) => s.ruleId === 'otDeviation')).toEqual([])
  })

  it('flags a low execution rate on several days in the window (D2)', () => {
    const r = runActionEngine(
      days([{ executionRatePct: 50 }, { executionRatePct: 95 }, { executionRatePct: 60 }, { executionRatePct: 65 }]),
      TODAY,
      CFG,
    )
    expect(r.suggestions[0]).toMatchObject({ ruleId: 'executionRate', dimension: 'd2', severity: 'high' })
    expect(r.suggestions[0].days).toHaveLength(3)
  })

  it('ignores days outside the window', () => {
    const old = days(Array(20).fill({ executionRatePct: 10 })).slice(0, 6)
    const r = runActionEngine(old, TODAY, CFG)
    expect(r.suggestions).toEqual([])
  })

  it('gives an info hint when wrong shifts are just under the threshold (D4)', () => {
    const r = runActionEngine(days([{ wrongShift: 3 }, { wrongShift: 0 }, { wrongShift: 2 }]), TODAY, CFG)
    expect(r.suggestions).toEqual([expect.objectContaining({ ruleId: 'wrongShift', severity: 'info', value: 5 })])
  })
})

describe('assessMaturity', () => {
  const base = { hasPlan: false, executionDays: 0, presenceDays: 0, productivityDays: 0, hasDlpFactor: false, pendingRules: [], totalRules: 3 }

  it('asks for input on an empty organisation', () => {
    const m = assessMaturity({ ...base, pendingRules: [] })
    expect(m.stages.map((s) => s.state)).toEqual(['needsInput', 'needsInput', 'needsInput', 'needsInput', 'needsInput', 'needsInput'])
    expect(m.kmixTargetDaysMissing).toBe(10)
  })

  it('reports how many days the forecast and the patterns still need', () => {
    const m = assessMaturity({
      ...base,
      hasPlan: true,
      executionDays: 2,
      presenceDays: 2,
      productivityDays: 2,
      pendingRules: [
        { ruleId: 'otDeviation', daysWithData: 2, daysMissing: 1 },
        { ruleId: 'executionRate', daysWithData: 2, daysMissing: 1 },
        { ruleId: 'wrongShift', daysWithData: 2, daysMissing: 1 },
      ],
    })
    expect(m.stages.find((s) => s.key === 'productivity')).toEqual({ key: 'productivity', state: 'active' })
    expect(m.stages.find((s) => s.key === 'forecast')).toEqual({ key: 'forecast', state: 'collecting', daysMissing: 3 })
    expect(m.stages.find((s) => s.key === 'patterns')).toEqual({ key: 'patterns', state: 'collecting', daysMissing: 1 })
    expect(m.kmixTargetDaysMissing).toBe(8)
  })

  it('needs no baseline days with a DLP factor', () => {
    expect(assessMaturity({ ...base, hasDlpFactor: true }).kmixTargetDaysMissing).toBe(0)
  })
})
