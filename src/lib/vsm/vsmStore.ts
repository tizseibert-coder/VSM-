import type { Tables } from '@/types/database'
import { reconcileChainEdges } from './chainOrder'

type Project = Tables<'projects'>
type Process = Tables<'processes'>
type Buffer = Tables<'inventory_buffers'>

/**
 * Der Zustand einer Wertstromkarte im Browser: Projekt, Prozesse, Puffer.
 *
 * Dieselben Uebergaenge tragen beide Betriebsarten. In der oeffentlichen Demo
 * gibt es keinen Server, hier steht der ganze Zustand. Im angemeldeten Editor
 * ist es der Zustand, den die Zeichenflaeche sofort zeigt, waehrend die
 * Server-Action nebenher schreibt — vorher rechnete der Editor ausschliesslich
 * aus Server-Props (`const processes = initialProcesses`), und jeder Klick
 * wartete auf Supabase-Schreiben, revalidatePath und router.refresh(), bevor
 * sich ueberhaupt etwas bewegte.
 *
 * Genau eine Implementierung fuer beide Wege: Was die Demo zeigt, ist damit
 * auch das, was der Editor unmittelbar nach einem Klick zeigt.
 *
 * Alle Operationen sind rein und geben einen neuen Zustand zurueck. Das ist
 * nicht nur Stilfrage: React erkennt eine Aenderung an der Referenz, und wer
 * hier an Ort und Stelle veraendert, bekommt eine Oberflaeche, die auf Klicks
 * nicht sichtbar reagiert.
 */
export interface VsmState {
  project: Project
  processes: Process[]
  buffers: Buffer[]
}

/** Laufende Nummer statt crypto.randomUUID(): Die Demo laeuft auch dort, wo
 *  die Web-Crypto-API fehlt, und lesbare Ids helfen beim Nachsehen. Im
 *  angemeldeten Editor ist so eine Id immer nur die Zwischenzeit bis zur
 *  echten aus der Datenbank — siehe VSMCanvas, wo genau die Schreibvorgaenge
 *  mit neuer Zeile weiterhin auf router.refresh() warten. */
let nextId = 0
const OPTIMISTIC_MARKER = '-neu-'
function newId(prefix: string): string {
  nextId += 1
  return `${prefix}${OPTIMISTIC_MARKER}${nextId}`
}

/**
 * Gehoert diese Id einer Zeile, die es nur im Browser gibt?
 *
 * Im angemeldeten Editor sind die Spalten in Postgres vom Typ uuid: Eine
 * solche Id dorthin zu schicken ist kein stiller Fehlschlag, sondern ein
 * harter Fehler (22P02) — und die Aenderung waere weg. Bis router.refresh()
 * die echte Zeile bringt, bleibt so ein Kaestchen deshalb unbearbeitbar.
 * In der Demo gibt es keine Datenbank; dort sind diese Ids die echten.
 */
export function isOptimisticId(id: string): boolean {
  return id.includes(OPTIMISTIC_MARKER)
}

function withProcesses(state: VsmState, processes: Process[]): VsmState {
  return { ...state, processes }
}

/** Eine leere Kante der Kette. Dieselben Vorgabewerte wie die Spalten in der
 *  Datenbank, damit ein hier angelegter Puffer sich nach dem naechsten
 *  router.refresh() nicht ploetzlich anders verhaelt. `scenario_id` bleibt
 *  null: In der Demo gibt es keine Szenarien, und im Editor lebt die Zeile nur
 *  bis zur Antwort des Servers — gefiltert wird ohnehin dort. */
function newBuffer(state: VsmState, from: string | null, to: string | null, wipCount = 0): Buffer {
  return {
    id: newId('buffer'),
    project_id: state.project.id,
    scenario_id: null,
    from_process_id: from,
    to_process_id: to,
    wip_count: wipCount,
    buffer_type: null,
    flow_style: null,
    kanban_type: null,
    x: null,
    y: null,
    created_at: state.project.created_at,
  }
}

/** Ein vollstaendiger Prozess mit den Vorgabewerten der Datenbank. Fuer das
 *  erste Kaestchen eines leeren Projekts gibt es keine Vorlagenzeile, aus der
 *  sich die uebrigen Spalten abschreiben liessen. */
function newProcess(state: VsmState, input: { name: string; cycleTime: number }): Process {
  return {
    id: newId('process'),
    project_id: state.project.id,
    scenario_id: null,
    name: input.name,
    cycle_time: input.cycleTime,
    changeover_time: 0,
    oee: 100,
    operator_count: 1,
    wip: 0,
    lane: 0,
    classification: null,
    color: '#ffffff',
    has_heijunka: false,
    is_pacemaker: false,
    kaizen_note: null,
    origin_process_id: null,
    height: 0,
    width: 0,
    x: null,
    y: null,
    created_at: state.project.created_at,
    updated_at: state.project.updated_at,
  }
}

export const vsmOperations = {
  /**
   * Haengt einen Prozess ans Ende der Kette — samt der Kanten, die dazu
   * gehoeren.
   *
   * Die gezeichnete Reihenfolge steht im Puffergraph, nicht in dieser Liste
   * (deriveChainOrder laeuft vom Lieferanten aus die Kanten entlang). Ein
   * Prozess ohne Kanten haengt deshalb sichtbar neben der Kette. Die
   * Server-Action addProcess legt genau diese beiden Zeilen mit an; hier
   * steht dieselbe Rechnung ohne Datenbank.
   */
  addProcess(state: VsmState, input: { name: string; cycleTime: number }): VsmState {
    const created = newProcess(state, input)

    // Die Kante "letzter Prozess -> Kunde" wird zur Kante "neuer Prozess ->
    // Kunde"; davor kommt eine neue Kante vom bisherigen Letzten.
    const terminal = state.buffers.find((b) => b.to_process_id === null)
    const buffers = terminal
      ? [
          ...state.buffers.map((b) =>
            b.id === terminal.id ? { ...b, from_process_id: created.id } : b
          ),
          newBuffer(state, terminal.from_process_id, created.id),
        ]
      : // Erster Prozess des Projekts: beide Randkanten entstehen neu.
        [...state.buffers, newBuffer(state, null, created.id), newBuffer(state, created.id, null)]

    return { ...state, processes: [...state.processes, created], buffers }
  },

  /**
   * Entfernt einen Prozess und schliesst die Luecke, die er hinterlaesst.
   *
   * Wie die Server-Action nur im einfachen Fall (genau ein Vorgaenger, genau
   * ein Nachfolger) — an einer echten Zusammenfuehrung waere jede Wahl
   * geraten, dort bleibt die Kante weg.
   */
  deleteProcess(state: VsmState, processId: string): VsmState {
    const incoming = state.buffers.filter((b) => b.to_process_id === processId)
    const outgoing = state.buffers.filter((b) => b.from_process_id === processId)
    const heals = incoming.length === 1 && outgoing.length === 1

    return {
      ...state,
      processes: state.processes.filter((p) => p.id !== processId),
      buffers: state.buffers
        // Ein Puffer ohne seine beiden Prozesse haette keine Bedeutung mehr und
        // wuerde im Diagramm als Dreieck im Nichts stehen bleiben.
        .filter((b) =>
          heals
            ? b.id !== outgoing[0].id
            : b.from_process_id !== processId && b.to_process_id !== processId
        )
        .map((b) =>
          heals && b.id === incoming[0].id
            ? { ...b, to_process_id: outgoing[0].to_process_id }
            : b
        ),
    }
  },

  /**
   * Aendert die genannten Felder eines Prozesses.
   *
   * Der Schrittmacher ist die eine Ausnahme von "nur diese eine Zeile": Es
   * gibt genau einen pro Wertstrom, und die Server-Action setzt ihn bei allen
   * anderen zurueck. Ohne dieselbe Regel hier stuenden bis zum naechsten
   * Neuladen zwei Schrittmacher-Markierungen im Bild, und Heijunka-Box,
   * Steuerungspfeile und Methodikpruefung haetten weiter den alten im Blick.
   */
  updateProcess(state: VsmState, processId: string, fields: Partial<Process>): VsmState {
    const becomesPacemaker = fields.is_pacemaker === true
    return withProcesses(
      state,
      state.processes.map((p) => {
        if (p.id === processId) return { ...p, ...fields }
        return becomesPacemaker && p.is_pacemaker ? { ...p, is_pacemaker: false } : p
      })
    )
  },

  updateProcessLane(state: VsmState, processId: string, lane: number): VsmState {
    return vsmOperations.updateProcess(state, processId, { lane })
  },

  /**
   * Neue Reihenfolge nach der uebergebenen Id-Liste; unbekannte Ids hinten
   * dran, damit nie ein Prozess verschwindet, weil die Liste unvollstaendig
   * war.
   *
   * Entscheidend sind die Kanten: Gezeichnet wird, was deriveChainOrder aus
   * dem Puffergraph liest — die Prozessliste allein umzusortieren bewegt
   * kein einziges Kaestchen. reconcileChainEdges haengt dieselben Zeilen um
   * wie die Server-Action reorderProcesses und behaelt dabei WIP und
   * Puffertyp, statt Kanten zu loeschen und neu anzulegen.
   */
  reorderProcesses(state: VsmState, order: string[]): VsmState {
    const rank = new Map(order.map((id, index) => [id, index]))
    const sorted = [...state.processes].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )

    const { repoint } = reconcileChainEdges(
      state.buffers.map((b) => ({ id: b.id, from: b.from_process_id, to: b.to_process_id })),
      order
    )
    const moved = new Map(repoint.map((edit) => [edit.id, edit]))

    return {
      ...withProcesses(state, sorted),
      buffers: state.buffers.map((b) => {
        const edit = moved.get(b.id)
        return edit ? { ...b, from_process_id: edit.from, to_process_id: edit.to } : b
      }),
    }
  },

  setBufferWip(
    state: VsmState,
    input: {
      fromProcessId: string | null
      toProcessId: string | null
      wipCount?: number
      bufferType?: string | null
      flowStyle?: string | null
      kanbanType?: string | null
    }
  ): VsmState {
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

    const created: Buffer = { ...newBuffer(state, input.fromProcessId, input.toProcessId), ...patch }
    return { ...state, buffers: [...state.buffers, created] }
  },

  deleteBufferConnection(state: VsmState, bufferId: string): VsmState {
    return { ...state, buffers: state.buffers.filter((b) => b.id !== bufferId) }
  },

  updateAnnualThroughput(state: VsmState, annualThroughput: number | null): VsmState {
    return { ...state, project: { ...state.project, annual_throughput: annualThroughput } }
  },

  updateAvailableMinutes(state: VsmState, availableMinutes: number): VsmState {
    return {
      ...state,
      project: { ...state.project, available_minutes_per_day: availableMinutes },
    }
  },

  updateProjectLabels(state: VsmState, labels: Partial<Project>): VsmState {
    return { ...state, project: { ...state.project, ...labels } }
  },
}
