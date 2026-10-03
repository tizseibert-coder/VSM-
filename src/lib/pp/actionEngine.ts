// Tagesplanung — Aktions-Engine: Muster ueber mehrere Tage erkennen und
// Massnahmen vorschlagen.
//
// Die sieben Regeln und ihre Schwellen sind die aus computeActionSuggestions
// des Vorgaengertools (v11); die Zahlen stehen in den Einstellungen
// (PpSettings.actionEngine). Geschaut wird auf die juengsten Tage *mit Daten*
// (Vorgabe 7), nicht auf Kalendertage: Ein Wochenende ohne Produktion
// verkuerzt das Fenster nicht.
//
// Gibt Schluessel und Zahlen zurueck, keinen Text — die Saetze stehen in
// messages/*.json, damit sie in beiden Sprachen gleich lauten.
//
// Neu gegenueber dem Vorgaengertool: Jede Regel meldet, ob sie ueberhaupt
// genug Tage mit ihren Daten hat. Fehlen sie, steht sie als „wartet" mit der
// Zahl der fehlenden Tage in `pending` — das ist die Anzeige „Datenreife",
// Stufe 5. Vorher hiess „kein Vorschlag" zweierlei: alles gut, oder noch zu
// wenig Daten.

import type { PpSettings } from './settings'

export interface DayMetrics {
  day: string
  pvPlan: number | null
  /** PV-Ist aus der Zeiterfassung; fehlt er, die Ist-OT (wie im Vorgaengertool). */
  pvActual: number | null
  dlp: number | null
  kmix: number | null
  executionRatePct: number | null
  wrongShift: number | null
  avgStartOffsetMin: number | null
  unplanned: number | null
}

export type Severity = 'high' | 'medium' | 'info'
export type RuleId = 'otOver' | 'otUnder' | 'executionRate' | 'wrongShift' | 'lateStart' | 'unplanned' | 'negativeDlp' | 'lowKmix'

export const RULE_DIMENSION: Record<RuleId, 'd1' | 'd2' | 'd3' | 'd4'> = {
  otOver: 'd1',
  otUnder: 'd1',
  executionRate: 'd2',
  unplanned: 'd2',
  negativeDlp: 'd3',
  lowKmix: 'd3',
  wrongShift: 'd4',
  lateStart: 'd4',
}

export interface Suggestion {
  ruleId: RuleId
  dimension: 'd1' | 'd2' | 'd3' | 'd4'
  severity: Severity
  /** Die auffaelligen Tage, auf die sich der Vorschlag stuetzt. */
  days: string[]
  /** Tage im Fenster mit den Daten dieser Regel — fuer „3 von 5 Tagen". */
  ofDays: number
  /** Summe, wo die Regel auf eine Summe schaut (falsche Schicht, ungeplant). */
  total?: number
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

export const RULE_COUNT = 8

export function runActionEngine(
  metrics: readonly DayMetrics[],
  config: PpSettings['actionEngine'],
  kmixTarget: number | null,
): EngineResult {
  const window = [...metrics].sort((a, b) => a.day.localeCompare(b.day)).slice(-config.windowDataDays)
  const suggestions: Suggestion[] = []
  const pending: PendingRule[] = []

  const rule = (
    ruleId: RuleId,
    severity: Severity,
    has: (m: DayMetrics) => boolean,
    hit: (m: DayMetrics) => boolean,
    minDays: number,
    total?: { of: (m: DayMetrics) => number; min: number },
  ) => {
    const withData = window.filter(has)
    // Eine Regel, die (auch) auf eine Summe schaut, kann schon an einem Tag
    // anschlagen; eine, die nur auf Tage schaut, braucht so viele Datentage,
    // wie sie auffaellige Tage verlangt.
    const needed = total ? 1 : minDays
    if (withData.length < needed) {
      pending.push({ ruleId, daysWithData: withData.length, daysMissing: needed - withData.length })
      return
    }
    const hits = withData.filter(hit)
    const sum = total ? withData.reduce((s, m) => s + total.of(m), 0) : undefined
    const byDays = minDays > 0 && hits.length >= minDays
    const bySum = total !== undefined && (sum as number) >= total.min
    if (byDays || bySum) {
      suggestions.push({ ruleId, dimension: RULE_DIMENSION[ruleId], severity, days: hits.map((m) => m.day), ofDays: withData.length, total: sum })
    }
  }

  const pvDelta = (m: DayMetrics) => (m.pvActual as number) - (m.pvPlan as number)
  const hasPv = (m: DayMetrics) => m.pvPlan !== null && m.pvPlan > 0 && m.pvActual !== null

  // D1 — mehr OT verbraucht als geplant: Personalplanung zu knapp.
  rule('otOver', 'high', hasPv, (m) => pvDelta(m) > config.otDeviationHours, config.otDeviationDays)
  // D1 — weniger OT als geplant: Ueberplanung.
  rule('otUnder', 'medium', hasPv, (m) => pvDelta(m) < -config.otDeviationHours, config.otDeviationDays)

  // D2 — geplante Umruestungen nicht umgesetzt.
  rule(
    'executionRate',
    'high',
    (m) => m.executionRatePct !== null,
    (m) => (m.executionRatePct as number) < config.executionRateBelowPct,
    config.executionRateDays,
  )

  // D4 — falsche Schicht: Summe *oder* betroffene Tage.
  rule(
    'wrongShift',
    'high',
    (m) => m.wrongShift !== null,
    (m) => (m.wrongShift as number) > 0,
    config.wrongShiftDays,
    { of: (m) => m.wrongShift as number, min: config.wrongShiftTotal },
  )

  // D4 — Rueststart im Schnitt deutlich verspaetet.
  rule(
    'lateStart',
    'medium',
    (m) => m.avgStartOffsetMin !== null,
    (m) => (m.avgStartOffsetMin as number) > config.lateStartMin,
    config.lateStartDays,
  )

  // D2 — ungeplante Umruestungen, Summe ueber das Fenster.
  rule('unplanned', 'medium', (m) => m.unplanned !== null, (m) => (m.unplanned as number) > 0, 0, {
    of: (m) => m.unplanned as number,
    min: config.unplannedTotal,
  })

  // D3 — negativer DLP.
  rule('negativeDlp', 'high', (m) => m.dlp !== null, (m) => (m.dlp as number) < 0, config.negativeDlpDays)

  // D3 — Kmix unter Ziel. Ohne Ziel (kein Faktor, Ausgangswert noch nicht
  // ermittelt) wartet die Regel, statt gegen eine erfundene Zahl zu pruefen.
  if (kmixTarget === null) {
    pending.push({ ruleId: 'lowKmix', daysWithData: 0, daysMissing: config.lowKmixDays })
  } else {
    rule('lowKmix', 'medium', (m) => m.kmix !== null, (m) => (m.kmix as number) < kmixTarget, config.lowKmixDays)
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, info: 2 }
  suggestions.sort((a, b) => rank[a.severity] - rank[b.severity])
  return { suggestions, pending }
}
