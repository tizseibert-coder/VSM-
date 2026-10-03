import { describe, expect, it } from 'vitest'
import { RULE_COUNT, runActionEngine, type DayMetrics } from '../actionEngine'
import { executionStats } from '../execution'
import { forecastUt } from '../forecast'
import { calcDlp, calcKmix, resolveKmixTarget } from '../kpi'
import { assessMaturity } from '../maturity'
import { countUnknownCodes, normalizeRosterCode } from '../shifts'
import { generateFactory, type FixtureFactory } from './generator'

describe('generateFactory', () => {
  it('is deterministic for a seed', () => {
    expect(generateFactory({ seed: 1, days: 10 })).toEqual(generateFactory({ seed: 1, days: 10 }))
    expect(generateFactory({ seed: 1, days: 10 })).not.toEqual(generateFactory({ seed: 2, days: 10 }))
  })

  it('builds a 53-week roster with raw codes, including sick leave and unknown codes', () => {
    const f = generateFactory({ seed: 7 })
    expect(f.people[0].weeks).toHaveLength(53)
    const raw = f.people.flatMap((p) => p.weeks.flatMap((w) => w.codes))
    expect(raw).toContain('k')
    const normalized = raw.map((c) => normalizeRosterCode(c, f.settings.shifts, f.settings.importCodeMap))
    expect(normalized.some((c) => c?.code === 'k')).toBe(false)
    expect(countUnknownCodes(normalized).length).toBeGreaterThan(0)
  })

  it('plans OT with role weights below the unweighted PV hours', () => {
    const day = generateFactory({ days: 3 }).days.find((d) => d.pvPlan > 0)
    expect(day && day.otPlan).toBeGreaterThan(0)
    expect(day && day.otPlan).toBeLessThan(day?.pvPlan ?? 0)
  })

  it('uses only invented numbers in the shape of real exports', () => {
    const f = generateFactory({ days: 3 })
    for (const m of f.machines) expect(m.id).toMatch(/^T\d{3}-A\d{2}$/)
    expect(f.people.every((p) => /^[A-Z]{3}$/.test(p.kuerzel))).toBe(true)
  })
})

// Die Reifestufen gegen die erfundene Firma: so sieht ein Kunde das Modul an
// Tag 0, nach einer Woche, nach zwei Wochen und nach zwei Monaten.
describe('maturity over time', () => {
  function assess(f: FixtureFactory) {
    const production = f.days.filter((d) => d.planned.length > 0)
    const productive = f.days.filter((d) => d.utActual !== null && d.otActual !== null)
    const kmix = productive.map((d) => calcKmix(d.utActual as number, d.otActual as number))
    const target = resolveKmixTarget(f.settings, kmix)
    const metrics: DayMetrics[] = production.map((d) => {
      const stats = executionStats(d.planned, d.actual, f.settings.shifts)
      const hasUtOt = d.utActual !== null && d.otActual !== null
      return {
        day: d.day,
        pvPlan: d.pvPlan,
        pvActual: d.otActual,
        dlp: hasUtOt ? calcDlp(d.utActual as number, d.otActual as number, 0.5) : null,
        kmix: hasUtOt ? calcKmix(d.utActual as number, d.otActual as number) : null,
        executionRatePct: stats.executionRatePct,
        wrongShift: stats.wrongShift,
        avgStartOffsetMin: stats.avgStartOffsetMin,
        unplanned: stats.unplanned,
      }
    })
    const engine = runActionEngine(metrics, f.settings.actionEngine, target.target)
    const maturity = assessMaturity({
      hasPlan: production.length > 0,
      executionDays: production.length,
      presenceDays: productive.length,
      productivityDays: productive.length,
      hasDlpFactor: f.settings.dlpFactor !== null,
      pendingRules: engine.pending,
      totalRules: RULE_COUNT,
    })
    const history = productive.map((d) => ({ utActual: d.utActual as number, utPlanned: d.utPlanned }))
    return { maturity, engine, target, forecast: forecastUt(100, history) }
  }
  const state = (r: ReturnType<typeof assess>, key: string) => r.maturity.stages.find((s) => s.key === key)?.state

  it('day 0: only the plan stage asks for input, nothing is invented', () => {
    const r = assess(generateFactory({ days: 0 }))
    expect(state(r, 'plan')).toBe('needsInput')
    expect(r.target.source).toBe('pending')
    expect(r.forecast.confidence.level).toBe('low')
    expect(r.engine.suggestions).toEqual([])
  })

  it('after one week: Kmix per day, forecast unlocked, baseline still collecting', () => {
    const r = assess(generateFactory({ days: 7 }))
    expect(state(r, 'productivity')).toBe('active')
    expect(state(r, 'forecast')).toBe('active')
    expect(r.target.source).toBe('pending')
  })

  it('after two weeks: baseline target set and the rules are running', () => {
    const r = assess(generateFactory({ days: 14 }))
    expect(r.target.source).toBe('baseline')
    expect(state(r, 'patterns')).toBe('active')
  })

  it('after two months: forecast confidence is no longer low', () => {
    const r = assess(generateFactory({ days: 60 }))
    expect(r.forecast.confidence.daysUsed).toBeGreaterThanOrEqual(30)
    expect(r.forecast.confidence.level).not.toBe('low')
  })
})
