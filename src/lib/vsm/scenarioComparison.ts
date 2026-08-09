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
 */
export function buildComparisonRows(
  states: ComparisonState[],
  annualThroughput: number | null
): ComparisonRow[] {
  return states.map((state) => ({
    id: state.id,
    label: state.label,
    processCount: state.processes.length,
    ...calculateKpis({
      processes: state.processes,
      buffers: state.buffers,
      annualThroughput,
    }),
  }))
}
