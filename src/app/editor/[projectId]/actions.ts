'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseProcessesCsv } from '@/lib/vsm/csvImport'
import { reconcileChainEdges } from '@/lib/vsm/chainOrder'

export interface AddProcessInput {
  name: string
  cycleTime: number
  oee?: number
  wip?: number
}

// Connections are explicit inventory_buffers rows (a small graph: each row
// is an edge from one process — or null for supplier — to another — or
// null for customer). addProcess/deleteProcess keep that graph consistent
// for the common "append to the end of the chain" case; anything beyond
// that (branching a second predecessor onto an existing process, i.e. a
// real merge/split) currently has no dedicated UI and would need direct
// data access — the renderer supports it, but there's no "add a second
// connection" affordance yet.
// scenarioId is null for the current/live state, or a scenarios.id for a
// Future-State snapshot — every query below scopes to it (see
// [[vsm-builder-project]] memory: "volle Zustands-Duplikation" model).
export async function addProcess(projectId: string, scenarioId: string | null, input: AddProcessInput) {
  const supabase = await createClient()

  let terminalQuery = supabase
    .from('inventory_buffers')
    .select('id, from_process_id')
    .eq('project_id', projectId)
    .is('to_process_id', null)
  terminalQuery = scenarioId ? terminalQuery.eq('scenario_id', scenarioId) : terminalQuery.is('scenario_id', null)
  const { data: terminalBuffer, error: terminalError } = await terminalQuery.maybeSingle()
  if (terminalError) throw new Error(terminalError.message)

  const { data: newProcess, error: insertError } = await supabase
    .from('processes')
    .insert({
      project_id: projectId,
      scenario_id: scenarioId,
      name: input.name,
      cycle_time: input.cycleTime,
      ...(input.oee !== undefined ? { oee: input.oee } : {}),
      ...(input.wip !== undefined ? { wip: input.wip } : {}),
    })
    .select('id')
    .single()
  if (insertError || !newProcess) {
    throw new Error(insertError?.message ?? 'Prozess konnte nicht angelegt werden.')
  }

  if (terminalBuffer) {
    // Repoint the existing "ships to customer" edge so it now starts from
    // the new process, and link the previous last process to it.
    const { error: repointError } = await supabase
      .from('inventory_buffers')
      .update({ from_process_id: newProcess.id })
      .eq('id', terminalBuffer.id)
    if (repointError) throw new Error(repointError.message)

    const { error: linkError } = await supabase.from('inventory_buffers').insert({
      project_id: projectId,
      scenario_id: scenarioId,
      from_process_id: terminalBuffer.from_process_id,
      to_process_id: newProcess.id,
      wip_count: 0,
    })
    if (linkError) throw new Error(linkError.message)
  } else {
    // First process in the project: create both boundary edges.
    const { error: boundaryError } = await supabase.from('inventory_buffers').insert([
      { project_id: projectId, scenario_id: scenarioId, from_process_id: null, to_process_id: newProcess.id, wip_count: 0 },
      { project_id: projectId, scenario_id: scenarioId, from_process_id: newProcess.id, to_process_id: null, wip_count: 0 },
    ])
    if (boundaryError) throw new Error(boundaryError.message)
  }

  revalidatePath(`/editor/${projectId}`)
}

// No scenarioId param — see the comment on updateProcessPosition above.
export async function deleteProcess(projectId: string, processId: string) {
  const supabase = await createClient()

  const { data: incoming, error: incomingError } = await supabase
    .from('inventory_buffers')
    .select('id, from_process_id')
    .eq('project_id', projectId)
    .eq('to_process_id', processId)
  if (incomingError) throw new Error(incomingError.message)

  const { data: outgoing, error: outgoingError } = await supabase
    .from('inventory_buffers')
    .select('id, to_process_id')
    .eq('project_id', projectId)
    .eq('from_process_id', processId)
  if (outgoingError) throw new Error(outgoingError.message)

  // Heal the chain only in the simple case (exactly one predecessor, one
  // successor) — deleting a genuine merge/split point would need explicit
  // user input on how to reconnect, so we leave those edges to cascade
  // away rather than guess.
  if (incoming?.length === 1 && outgoing?.length === 1) {
    const { error } = await supabase
      .from('inventory_buffers')
      .update({ to_process_id: outgoing[0].to_process_id })
      .eq('id', incoming[0].id)
    if (error) throw new Error(error.message)
  }

  const { error } = await supabase.from('processes').delete().eq('id', processId)
  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

export async function importProcessesCsv(projectId: string, scenarioId: string | null, csvText: string) {
  // Throws with a Zeile-N message on bad input; caller shows it verbatim.
  const rows = parseProcessesCsv(csvText)

  if (rows.length === 0) {
    throw new Error('Die CSV-Datei enthält keine Zeilen.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('processes').insert(
    rows.map((row) => ({
      project_id: projectId,
      scenario_id: scenarioId,
      name: row.name,
      cycle_time: row.cycleTime,
      ...(row.oee !== undefined ? { oee: row.oee } : {}),
      ...(row.wip !== undefined ? { wip: row.wip } : {}),
    }))
  )

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

export async function updateAnnualThroughput(projectId: string, annualThroughput: number | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ annual_throughput: annualThroughput })
    .eq('id', projectId)

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

// Takt time's other input, previously hardcoded to SHIFT_MINUTES with no way
// to configure it — see lib/vsm/calculations.ts (availableMinutesPerDay).
export async function updateAvailableMinutes(projectId: string, availableMinutesPerDay: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ available_minutes_per_day: availableMinutesPerDay })
    .eq('id', projectId)

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

// No scenarioId here (unlike addProcess/importProcessesCsv/setBufferWip):
// processId already uniquely identifies the row regardless of which state
// it belongs to, so there is nothing extra to scope.
export async function updateProcessPosition(projectId: string, processId: string, x: number, y: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('processes').update({ x, y }).eq('id', processId)

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

// Moves a process to a different parallel row (0 = main line). Position is
// otherwise fully derived from lane + chain order — see [[vsm-builder-project]]
// memory: no more freeform x/y dragging.
export async function updateProcessLane(projectId: string, processId: string, lane: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('processes')
    .update({ lane: Math.max(0, lane) })
    .eq('id', processId)

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

// Re-wires the buffer chain to match a new left-to-right order — called
// after a drag that changed which process comes before/after which. Repoints
// existing rows rather than delete+insert so WIP/buffer_type/flow_style/
// kanban_type survive the move; scenarioId scopes it the same way as the
// other actions.
export async function reorderProcesses(projectId: string, scenarioId: string | null, orderedProcessIds: string[]) {
  const supabase = await createClient()

  let query = supabase
    .from('inventory_buffers')
    .select('id, from_process_id, to_process_id')
    .eq('project_id', projectId)
  query = scenarioId ? query.eq('scenario_id', scenarioId) : query.is('scenario_id', null)
  const { data: existing, error: fetchError } = await query
  if (fetchError) throw new Error(fetchError.message)

  const { repoint } = reconcileChainEdges(
    (existing ?? []).map((b) => ({ id: b.id, from: b.from_process_id, to: b.to_process_id })),
    orderedProcessIds
  )

  for (const edit of repoint) {
    const { error } = await supabase
      .from('inventory_buffers')
      .update({ from_process_id: edit.from, to_process_id: edit.to })
      .eq('id', edit.id)
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/editor/${projectId}`)
}

export interface UpdateProcessInput {
  name: string
  cycleTime: number
  oee: number
  operatorCount: number
  changeoverTime: number
  isPacemaker: boolean
  /** 'va' | 'nva' | 'necessary_nva' | null — see lib/vsm/classification.ts for the allowed set. */
  classification?: string | null
}

// The pacemaker (Schrittmacher) is the one process scheduled directly by
// production control — everything else is pulled via kanban/FIFO. Only one
// process per (project, scenario) scope may hold it, enforced here at the
// app level (same pattern as the buffer find-then-update-or-insert logic)
// rather than a DB constraint.
export async function updateProcess(projectId: string, processId: string, input: UpdateProcessInput) {
  const supabase = await createClient()

  if (input.isPacemaker) {
    const { data: current, error: findError } = await supabase
      .from('processes')
      .select('scenario_id')
      .eq('id', processId)
      .single()
    if (findError) throw new Error(findError.message)

    let unsetQuery = supabase
      .from('processes')
      .update({ is_pacemaker: false })
      .eq('project_id', projectId)
      .neq('id', processId)
    unsetQuery = current.scenario_id
      ? unsetQuery.eq('scenario_id', current.scenario_id)
      : unsetQuery.is('scenario_id', null)
    const { error: unsetError } = await unsetQuery
    if (unsetError) throw new Error(unsetError.message)
  }

  const { error } = await supabase
    .from('processes')
    .update({
      name: input.name,
      cycle_time: input.cycleTime,
      oee: input.oee,
      operator_count: input.operatorCount,
      changeover_time: input.changeoverTime,
      is_pacemaker: input.isPacemaker,
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    })
    .eq('id', processId)

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

export interface SetBufferWipInput {
  fromProcessId: string | null
  toProcessId: string | null
  wipCount: number
  /** 'standard' (uncontrolled triangle, default) | 'supermarket' | 'fifo' | 'continuous' (one-piece flow, no triangle) | 'safety_stock' (triangle + "SS" label) */
  bufferType?: string | null
  /** 'push' | 'pull' | 'shipment' | null (auto-derive from position/buffer_type) */
  flowStyle?: string | null
  /** 'production' | 'transport' | null — icon variant for a supermarket's pull arrow.
   *  Display-only distinction, not a full kanban-card simulation. Ignored for
   *  non-supermarket buffers. */
  kanbanType?: string | null
}

// Upserts the WIP count (and optionally the pull-system type) for the gap
// between two processes (or before the first / after the last, when one
// side is null). There's no unique constraint on
// (from_process_id, to_process_id) to upsert against, so this does a manual
// find-then-update-or-insert. scenarioId scopes both the lookup (the
// boundary case where from AND to are both null could otherwise collide
// across states) and the insert.
export async function setBufferWip(projectId: string, scenarioId: string | null, input: SetBufferWipInput) {
  const supabase = await createClient()

  let query = supabase.from('inventory_buffers').select('id').eq('project_id', projectId)
  query = scenarioId ? query.eq('scenario_id', scenarioId) : query.is('scenario_id', null)
  query = input.fromProcessId
    ? query.eq('from_process_id', input.fromProcessId)
    : query.is('from_process_id', null)
  query = input.toProcessId ? query.eq('to_process_id', input.toProcessId) : query.is('to_process_id', null)

  const { data: existing, error: findError } = await query.maybeSingle()
  if (findError) throw new Error(findError.message)

  const bufferType = input.bufferType ?? 'standard'
  const flowStyle = input.flowStyle ?? null
  // Only a supermarket has a pull arrow to put a kanban icon on — drop the
  // value for any other buffer type instead of storing stale state.
  const kanbanType = bufferType === 'supermarket' ? (input.kanbanType ?? null) : null

  if (existing) {
    const { error } = await supabase
      .from('inventory_buffers')
      .update({ wip_count: input.wipCount, buffer_type: bufferType, flow_style: flowStyle, kanban_type: kanbanType })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('inventory_buffers').insert({
      project_id: projectId,
      scenario_id: scenarioId,
      from_process_id: input.fromProcessId,
      to_process_id: input.toProcessId,
      wip_count: input.wipCount,
      buffer_type: bufferType,
      flow_style: flowStyle,
      kanban_type: kanbanType,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/editor/${projectId}`)
}

// Removes a single connection (Phase 6: Mehrstrang-UI) without touching the
// processes on either end — the counterpart to setBufferWip's create/update.
// Needed once a process can have more than one predecessor/successor: the
// user must be able to undo a wrongly-added branch, or intentionally split
// a merge apart, without deleting a whole process (deleteProcess already
// cascades any edges automatically, but that's too blunt for "just remove
// this one connection").
export async function deleteBufferConnection(projectId: string, bufferId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory_buffers')
    .delete()
    .eq('id', bufferId)
    .eq('project_id', projectId) // belt-and-suspenders scoping, RLS already enforces org ownership

  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}

export interface UpdateProjectLabelsInput {
  supplierName?: string
  customerName?: string
  erpLabel?: string
}

export async function updateProjectLabels(projectId: string, input: UpdateProjectLabelsInput) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('projects')
    .update({
      ...(input.supplierName !== undefined ? { supplier_name: input.supplierName } : {}),
      ...(input.customerName !== undefined ? { customer_name: input.customerName } : {}),
      ...(input.erpLabel !== undefined ? { erp_label: input.erpLabel } : {}),
    })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
}
