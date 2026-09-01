import type { Tables } from '@/types/database'

type Project = Tables<'projects'>
type Process = Tables<'processes'>
type Buffer = Tables<'inventory_buffers'>

/**
 * Der Zustand der oeffentlichen Demo.
 *
 * Der Editor haelt sonst keinen eigenen Zustand: `const processes =
 * initialProcesses`, jede Aenderung geht als Server-Action raus und kommt
 * ueber router.refresh() als neue Props zurueck. Ohne Server gibt es diesen
 * Weg nicht, also bildet dieses Modul ihn im Browser nach.
 *
 * Alle Operationen sind rein und geben einen neuen Zustand zurueck. Das ist
 * nicht nur Stilfrage: React erkennt eine Aenderung an der Referenz, und wer
 * hier an Ort und Stelle veraendert, bekommt eine Demo, die auf Klicks nicht
 * sichtbar reagiert.
 */
export interface DemoState {
  project: Project
  processes: Process[]
  buffers: Buffer[]
}

/** Laufende Nummer statt crypto.randomUUID(): Die Demo laeuft auch dort, wo
 *  die Web-Crypto-API fehlt, und lesbare Ids helfen beim Nachsehen. */
let nextId = 0
function newId(prefix: string): string {
  nextId += 1
  return `${prefix}-neu-${nextId}`
}

function withProcesses(state: DemoState, processes: Process[]): DemoState {
  return { ...state, processes }
}

export const demoOperations = {
  addProcess(state: DemoState, input: { name: string; cycleTime: number }): DemoState {
    const template = state.processes[0]
    const created: Process = {
      ...template,
      id: newId('process'),
      name: input.name,
      cycle_time: input.cycleTime,
      changeover_time: 0,
      oee: 100,
      operator_count: 1,
      wip: 0,
      lane: 0,
      is_pacemaker: false,
      classification: null,
      kaizen_note: null,
    }
    return withProcesses(state, [...state.processes, created])
  },

  deleteProcess(state: DemoState, processId: string): DemoState {
    return {
      ...state,
      processes: state.processes.filter((p) => p.id !== processId),
      // Ein Puffer ohne seine beiden Prozesse haette keine Bedeutung mehr und
      // wuerde im Diagramm als Dreieck im Nichts stehen bleiben.
      buffers: state.buffers.filter(
        (b) => b.from_process_id !== processId && b.to_process_id !== processId
      ),
    }
  },

  updateProcess(state: DemoState, processId: string, fields: Partial<Process>): DemoState {
    return withProcesses(
      state,
      state.processes.map((p) => (p.id === processId ? { ...p, ...fields } : p))
    )
  },

  updateProcessLane(state: DemoState, processId: string, lane: number): DemoState {
    return demoOperations.updateProcess(state, processId, { lane })
  },

  /** Reihenfolge nach der uebergebenen Id-Liste; unbekannte Ids hinten dran,
   *  damit nie ein Prozess verschwindet, weil die Liste unvollstaendig war. */
  reorderProcesses(state: DemoState, order: string[]): DemoState {
    const rank = new Map(order.map((id, index) => [id, index]))
    const sorted = [...state.processes].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
    return withProcesses(state, sorted)
  },

  setBufferWip(
    state: DemoState,
    input: {
      fromProcessId: string | null
      toProcessId: string | null
      wipCount?: number
      bufferType?: string | null
      flowStyle?: string | null
      kanbanType?: string | null
    }
  ): DemoState {
    const existing = state.buffers.find(
      (b) => b.from_process_id === input.fromProcessId && b.to_process_id === input.toProcessId
    )

    const patch = {
      ...(input.wipCount !== undefined ? { wip_count: input.wipCount } : {}),
      ...(input.bufferType !== undefined ? { buffer_type: input.bufferType } : {}),
      ...(input.flowStyle !== undefined ? { flow_style: input.flowStyle } : {}),
      ...(input.kanbanType !== undefined ? { kanban_type: input.kanbanType } : {}),
    }

    if (existing) {
      return {
        ...state,
        buffers: state.buffers.map((b) => (b.id === existing.id ? { ...b, ...patch } : b)),
      }
    }

    const created: Buffer = {
      id: newId('buffer'),
      project_id: state.project.id,
      scenario_id: null,
      from_process_id: input.fromProcessId,
      to_process_id: input.toProcessId,
      wip_count: input.wipCount ?? 0,
      buffer_type: input.bufferType ?? null,
      flow_style: input.flowStyle ?? null,
      kanban_type: input.kanbanType ?? null,
      x: null,
      y: null,
      created_at: state.project.created_at,
      ...patch,
    }
    return { ...state, buffers: [...state.buffers, created] }
  },

  deleteBufferConnection(state: DemoState, bufferId: string): DemoState {
    return { ...state, buffers: state.buffers.filter((b) => b.id !== bufferId) }
  },

  updateAnnualThroughput(state: DemoState, annualThroughput: number | null): DemoState {
    return { ...state, project: { ...state.project, annual_throughput: annualThroughput } }
  },

  updateAvailableMinutes(state: DemoState, availableMinutes: number): DemoState {
    return {
      ...state,
      project: { ...state.project, available_minutes_per_day: availableMinutes },
    }
  },

  updateProjectLabels(state: DemoState, labels: Partial<Project>): DemoState {
    return { ...state, project: { ...state.project, ...labels } }
  },
}
