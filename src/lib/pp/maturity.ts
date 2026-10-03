// Tagesplanung — Datenreife: was schon gerechnet wird und was die naechste
// Eingabe freischaltet.
//
// Der Gedanke dahinter (docs/plan-tagesplanung-modul.md, „Reifestufen"): Ein
// KMU hat selten Produktivitaetsdaten. Jede Stufe hat ab dem Tag, an dem ihre
// Eingabe vorliegt, einen eigenen Nutzen, und die Anzeige sagt konkret, was
// fehlt — „noch 6 Tage", nicht „zu wenig Daten".

import type { PendingRule } from './actionEngine'
import { FORECAST_MIN_DAYS } from './forecast'
import { BASELINE_DAYS } from './kpi'

export type StageKey = 'plan' | 'execution' | 'personnel' | 'productivity' | 'forecast' | 'patterns'

export type StageStatus =
  | { key: StageKey; state: 'active' }
  /** Die Eingabe fehlt noch ganz — der Hinweis sagt, welche. */
  | { key: StageKey; state: 'needsInput' }
  /** Die Eingabe kommt, es fehlen noch Tage. */
  | { key: StageKey; state: 'collecting'; daysMissing: number }

export interface MaturityInput {
  /** Mindestens ein Tagesplan gespeichert. */
  hasPlan: boolean
  /** Tage mit erfassten Ist-Ruestungen. */
  executionDays: number
  /** Tage mit erfassten Praesenzstunden. */
  presenceDays: number
  /** Tage mit UT und OT (damit Kmix). */
  productivityDays: number
  /** Ob das Kmix-Ziel aus dem Faktor kommt; sonst braucht es BASELINE_DAYS Tage. */
  hasDlpFactor: boolean
  /** Aus runActionEngine — die Regeln, die noch auf Tage warten. */
  pendingRules: readonly PendingRule[]
  /** Anzahl Regeln insgesamt (RULE_COUNT). */
  totalRules: number
}

export interface Maturity {
  stages: StageStatus[]
  /** Die Ampel des Kmix braucht ein Ziel; ohne Faktor fehlen dafuer noch Tage. */
  kmixTargetDaysMissing: number
}

export function assessMaturity(input: MaturityInput): Maturity {
  const daysStage = (key: StageKey, days: number, needed: number): StageStatus =>
    days <= 0 ? { key, state: 'needsInput' } : days >= needed ? { key, state: 'active' } : { key, state: 'collecting', daysMissing: needed - days }

  const minPending = input.pendingRules.length > 0 ? Math.min(...input.pendingRules.map((r) => r.daysMissing)) : 0
  const patterns: StageStatus =
    input.productivityDays <= 0 && input.executionDays <= 0
      ? { key: 'patterns', state: 'needsInput' }
      : input.pendingRules.length < input.totalRules
        ? { key: 'patterns', state: 'active' }
        : { key: 'patterns', state: 'collecting', daysMissing: minPending }

  return {
    stages: [
      input.hasPlan ? { key: 'plan', state: 'active' } : { key: 'plan', state: 'needsInput' },
      daysStage('execution', input.executionDays, 1),
      daysStage('personnel', input.presenceDays, 1),
      daysStage('productivity', input.productivityDays, 1),
      daysStage('forecast', input.productivityDays, FORECAST_MIN_DAYS),
      patterns,
    ],
    kmixTargetDaysMissing: input.hasDlpFactor ? 0 : Math.max(0, BASELINE_DAYS - input.productivityDays),
  }
}
