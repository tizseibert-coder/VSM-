// Pure aggregation layer for the scenario comparison view: turns a list of
// independent VSM states (Ist-Zustand + each Future-State scenario, each its
// own full process/buffer set under the "volle Zustands-Duplikation" model)
// into one KPI row per state, reusing the already-verified calculateKpis.

import { calculateKpis, type KpiInput, type KpiResult } from './calculations'

export interface ComparisonState {
  /** null identifies the current/live state (scenario_id IS NULL in the DB). */
  id: string | null
  label: string
  processes: KpiInput['processes']
  buffers: KpiInput['buffers']
}

export interface ComparisonRow extends KpiResult {
  id: string | null
  label: string
  processCount: number
}

/**
 * Computes comparable KPIs for every state against the same customer demand
 * (annualThroughput is a project-level constraint, not something that
 * differs per scenario in the current model — see project memory).
 *
 * [Code-Review 2026-09-04] `availableMinutesPerDay` fehlte hier und
 * calculateKpis fiel damit auf seine Vorgabe von 480 zurueck — auf einem
 * Projekt mit zwei Schichten rechnete der Vergleich also gegen eine
 * Schichtzeit, die das Projekt gar nicht hat. Seit der Vergleich auch auf
 * Seite zwei des PDF steht, war das nicht nur falsch, sondern sichtbar
 * falsch: Seite eins nannte fuer denselben Ist-Zustand eine andere Taktzeit
 * als Seite zwei. Wie der Kundenbedarf ist die Schichtzeit eine Eigenschaft
 * des Projekts und gilt fuer alle Zustaende gleich.
 */
export function buildComparisonRows(
  states: ComparisonState[],
  annualThroughput: number | null,
  availableMinutesPerDay?: number
): ComparisonRow[] {
  return states.map((state) => ({
    id: state.id,
    label: state.label,
    processCount: state.processes.length,
    ...calculateKpis({
      processes: state.processes,
      buffers: state.buffers,
      annualThroughput,
      availableMinutesPerDay,
    }),
  }))
}
