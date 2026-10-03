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
    pvPlan: null,
    pvActual: null,
    dlp: null,
    kmix: null,
    executionRatePct: null,
    wrongShift: null,
    avgStartOffsetMin: null,
    unplanned: null,
    ...v,
  }))
}
const ids = (r: ReturnType<typeof runActionEngine>) => r.suggestions.map((s) => s.ruleId)

describe('runActionEngine', () => {
  it('waits while a rule has fewer days than it needs, instead of staying silent', () => {
    const r = runActionEngine(days([{ pvPlan: 100, pvActual: 110 }, { pvPlan: 100, pvActual: 110 }]), CFG, 2)
    expect(r.suggestions).toEqual([])
    expect(r.pending).toContainEqual({ ruleId: 'otOver', daysWithData: 2, daysMissing: 1 })
    expect(r.pending.find((p) => p.ruleId === 'negativeDlp')).toEqual({ ruleId: 'negativeDlp', daysWithData: 0, daysMissing: 2 })
  })

  it('D1: more PV used than planned on 3 days is high, less than planned is medium', () => {
    const over = runActionEngine(
      days([{ pvPlan: 100, pvActual: 104 }, { pvPlan: 100, pvActual: 100 }, { pvPlan: 100, pvActual: 105 }, { pvPlan: 100, pvActual: 103.5 }]),
      CFG,
      2,
    )
    expect(over.suggestions).toEqual([expect.objectContaining({ ruleId: 'otOver', dimension: 'd1', severity: 'high', ofDays: 4 })])
    expect(over.suggestions[0].days).toHaveLength(3)

    const under = runActionEngine(days(Array(3).fill({ pvPlan: 100, pvActual: 90 })), CFG, 2)
    expect(under.suggestions).toEqual([expect.objectContaining({ ruleId: 'otUnder', severity: 'medium' })])
  })

  it('D1: exactly 3 h deviation is not yet conspicuous', () => {
    expect(ids(runActionEngine(days(Array(3).fill({ pvPlan: 100, pvActual: 103 })), CFG, 2))).toEqual([])
  })

  it('D2: execution rate below 70 % on 2 days', () => {
    const r = runActionEngine(days([{ executionRatePct: 50 }, { executionRatePct: 95 }, { executionRatePct: 69 }]), CFG, 2)
    expect(r.suggestions).toEqual([expect.objectContaining({ ruleId: 'executionRate', dimension: 'd2', severity: 'high' })])
  })

  it('D4: wrong shift fires on a total of 3 even within one day, or on 3 affected days', () => {
    expect(ids(runActionEngine(days([{ wrongShift: 3 }]), CFG, 2))).toEqual(['wrongShift'])
    expect(ids(runActionEngine(days([{ wrongShift: 1 }, { wrongShift: 1 }]), CFG, 2))).toEqual([])
    const threeDays = runActionEngine(days([{ wrongShift: 1 }, { wrongShift: 1 }, { wrongShift: 1 }]), CFG, 2)
    expect(threeDays.suggestions[0]).toMatchObject({ ruleId: 'wrongShift', total: 3 })
  })

  it('D4: average start more than 30 min late on 3 days', () => {
    const r = runActionEngine(days([{ avgStartOffsetMin: 31 }, { avgStartOffsetMin: 45 }, { avgStartOffsetMin: -40 }, { avgStartOffsetMin: 60 }]), CFG, 2)
    expect(r.suggestions).toEqual([expect.objectContaining({ ruleId: 'lateStart', severity: 'medium' })])
  })

  it('D2: 3 unplanned changeovers in the window', () => {
    const r = runActionEngine(days([{ unplanned: 1 }, { unplanned: 0 }, { unplanned: 2 }]), CFG, 2)
    expect(r.suggestions).toEqual([expect.objectContaining({ ruleId: 'unplanned', total: 3 })])
  })

  it('D3: negative DLP on 2 days and Kmix under target on 3 days', () => {
    const r = runActionEngine(days([{ dlp: -1, kmix: 1.5 }, { dlp: 2, kmix: 1.9 }, { dlp: -0.5, kmix: 1.8 }]), CFG, 2)
    expect(ids(r)).toEqual(['negativeDlp', 'lowKmix'])
  })

  it('D3: the Kmix rule waits while there is no target', () => {
    const r = runActionEngine(days(Array(5).fill({ kmix: 0.5 })), CFG, null)
    expect(ids(r)).not.toContain('lowKmix')
    expect(r.pending.map((p) => p.ruleId)).toContain('lowKmix')
  })

  it('looks only at the most recent 7 days with data', () => {
    const old = days([...Array(3).fill({ executionRatePct: 10 }), ...Array(7).fill({ executionRatePct: 95 })])
    expect(ids(runActionEngine(old, CFG, 2))).toEqual([])
  })

  it('sorts high before medium', () => {
    const r = runActionEngine(days([{ unplanned: 3, dlp: -1 }, { dlp: -1 }]), CFG, 2)
    expect(r.suggestions.map((s) => s.severity)).toEqual(['high', 'medium'])
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
        { ruleId: 'otOver', daysWithData: 2, daysMissing: 1 },
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
