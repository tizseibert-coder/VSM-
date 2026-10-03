// Tagesplanung — Aktions-Engine: Muster ueber mehrere Tage erkennen und
// Massnahmen vorschlagen.
//
// Gibt Schluessel und Zahlen zurueck, keinen Text — die Saetze stehen in
// messages/*.json, damit sie in beiden Sprachen gleich lauten.
//
// Eine Regel schlaegt nur an, wenn ihr Fenster genug Tage mit den Daten hat,
// die sie braucht. Fehlen sie, meldet sie sich als „wartet" mit der Zahl der
// fehlenden Tage — das ist die Anzeige „Datenreife", Stufe 5. Ein Vorschlag
// aus zwei Datentagen waere ein Zufallsbefund mit dem Gewicht einer Regel.

import { addDays } from './dates'
import type { PpSettings } from './settings'

export interface DayMetrics {
  day: string
  /** Geplante Personalstunden des Tages (PV-Plan). */
  otPlan: number | null
  otActual: number | null
  executionRatePct: number | null
  wrongShift: number | null
}

export type Severity = 'high' | 'medium' | 'info'
export type RuleId = 'otDeviation' | 'executionRate' | 'wrongShift'

export interface Suggestion {
  ruleId: RuleId
  dimension: 'd1' | 'd2' | 'd4'
  severity: Severity
  /** Die auffaelligen Tage, auf die sich der Vorschlag stuetzt. */
  days: string[]
  /** Nur bei otDeviation: ob mehr oder weniger OT als geplant anfiel. */
  direction?: 'over' | 'under'
  /** Kennzahl fuer den Text, z. B. mittlere Abweichung in Stunden. */
  value: number
}

export interface PendingRule {
  ruleId: RuleId
  daysWithData: number
  daysMissing: number
}

export interface EngineResult {
  suggestions: Suggestion[]
  pending: PendingRule[]
}

export function runActionEngine(
  metrics: readonly DayMetrics[],
  today: string,
  config: PpSettings['actionEngine'],
): EngineResult {
  const from = addDays(today, -(config.windowDays - 1))
  const window = [...metrics].filter((m) => m.day >= from && m.day <= today).sort((a, b) => a.day.localeCompare(b.day))
  const suggestions: Suggestion[] = []
  const pending: PendingRule[] = []

  const ready = (ruleId: RuleId, days: number) => {
    if (days >= config.minDays) return true
    pending.push({ ruleId, daysWithData: days, daysMissing: config.minDays - days })
    return false
  }

  // D1 — OT mehrfach deutlich ueber oder unter Plan, an Datentagen in Folge.
  // „In Folge" zaehlt Tage mit Daten, nicht Kalendertage: Ein Wochenende ohne
  // Produktion unterbricht kein Muster.
  const ot = window.filter((m) => m.otPlan !== null && m.otActual !== null)
  if (ready('otDeviation', ot.length)) {
    for (const direction of ['over', 'under'] as const) {
      const run = longestRun(ot, (m) => {
        const d = (m.otActual as number) - (m.otPlan as number)
        return direction === 'over' ? d >= config.otDeviationHours : d <= -config.otDeviationHours
      })
      if (run.length >= config.minDays) {
        const mean = run.reduce((s, m) => s + Math.abs((m.otActual as number) - (m.otPlan as number)), 0) / run.length
        suggestions.push({
          ruleId: 'otDeviation',
          dimension: 'd1',
          severity: run.length >= config.minDays + 2 ? 'high' : 'medium',
          direction,
          days: run.map((m) => m.day),
          value: mean,
        })
      }
    }
  }

  // D2 — Ausfuehrungsrate an mehreren Tagen im Fenster unter der Schwelle.
  const exec = window.filter((m) => m.executionRatePct !== null)
  if (ready('executionRate', exec.length)) {
    const low = exec.filter((m) => (m.executionRatePct as number) < config.executionRateBelowPct)
    if (low.length >= config.minDays) {
      suggestions.push({
        ruleId: 'executionRate',
        dimension: 'd2',
        severity: low.length >= exec.length / 2 ? 'high' : 'medium',
        days: low.map((m) => m.day),
        value: low.reduce((s, m) => s + (m.executionRatePct as number), 0) / low.length,
      })
    }
  }

  // D4 — gehaeufte falsche Schichtzuordnung: Hinweis auf die Schichtuebergabe.
  const shift = window.filter((m) => m.wrongShift !== null)
  if (ready('wrongShift', shift.length)) {
    const bad = shift.filter((m) => (m.wrongShift as number) >= config.wrongShiftPerDay)
    if (bad.length >= config.minDays) {
      suggestions.push({
        ruleId: 'wrongShift',
        dimension: 'd4',
        severity: 'medium',
        days: bad.map((m) => m.day),
        value: bad.reduce((s, m) => s + (m.wrongShift as number), 0),
      })
    } else if (bad.length > 0 && bad.length === config.minDays - 1) {
      // Knapp unter der Schwelle: kein Vorschlag mit Gewicht, aber ein Hinweis.
      suggestions.push({
        ruleId: 'wrongShift',
        dimension: 'd4',
        severity: 'info',
        days: bad.map((m) => m.day),
        value: bad.reduce((s, m) => s + (m.wrongShift as number), 0),
      })
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, info: 2 }
  suggestions.sort((a, b) => rank[a.severity] - rank[b.severity])
  return { suggestions, pending }
}

/** Die laengste ununterbrochene Folge, die `hit` erfuellt; bei Gleichstand die juengste. */
function longestRun<T>(items: readonly T[], hit: (item: T) => boolean): T[] {
  let best: T[] = []
  let current: T[] = []
  for (const item of items) {
    if (hit(item)) {
      current.push(item)
      if (current.length >= best.length) best = [...current]
    } else {
      current = []
    }
  }
  return best
}
