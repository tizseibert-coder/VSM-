'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Creates a new Future-State scenario by deep-copying the current
// (scenario_id IS NULL) processes + inventory_buffers into fresh rows tied
// to the new scenario — "volle Zustands-Duplikation": a scenario is a full,
// independently editable VSM state, not a delta against the current one.
export async function createScenario(projectId: string, formData: FormData) {
  const type = formData.get('type') as string | null
  const name = (formData.get('name') as string | null)?.trim()

  if (!type || !['A', 'B', 'C'].includes(type) || !name) {
    redirect(`/editor/${projectId}?error=` + encodeURIComponent('Typ und Name sind erforderlich.'))
  }

  const supabase = await createClient()

  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .insert({ project_id: projectId, type, name })
    .select('id')
    .single()
  if (scenarioError || !scenario) {
    redirect(
      `/editor/${projectId}?error=` +
        encodeURIComponent(scenarioError?.message ?? 'Szenario konnte nicht angelegt werden.')
    )
  }

  const { data: sourceProcesses, error: processesError } = await supabase
    .from('processes')
    .select('*')
    .eq('project_id', projectId)
    .is('scenario_id', null)
    .order('created_at', { ascending: true })
  if (processesError) {
    redirect(`/editor/${projectId}?error=` + encodeURIComponent(processesError.message))
  }

  const idMap = new Map<string, string>()

  if (sourceProcesses && sourceProcesses.length > 0) {
    const { data: copiedProcesses, error: copyError } = await supabase
      .from('processes')
      .insert(
        sourceProcesses.map((p) => ({
          project_id: projectId,
          scenario_id: scenario.id,
          origin_process_id: p.id,
          name: p.name,
          cycle_time: p.cycle_time,
          oee: p.oee,
          wip: p.wip,
          changeover_time: p.changeover_time,
          classification: p.classification,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          color: p.color,
        }))
      )
      .select('id, origin_process_id')
    if (copyError || !copiedProcesses) {
      redirect(
        `/editor/${projectId}?error=` +
          encodeURIComponent(copyError?.message ?? 'Prozesse konnten nicht kopiert werden.')
      )
    }
    for (const cp of copiedProcesses ?? []) {
      if (cp.origin_process_id) idMap.set(cp.origin_process_id, cp.id)
    }
  }

  const { data: sourceBuffers, error: buffersError } = await supabase
    .from('inventory_buffers')
    .select('*')
    .eq('project_id', projectId)
    .is('scenario_id', null)
  if (buffersError) {
    redirect(`/editor/${projectId}?error=` + encodeURIComponent(buffersError.message))
  }

  if (sourceBuffers && sourceBuffers.length > 0) {
    const { error: bufferCopyError } = await supabase.from('inventory_buffers').insert(
      sourceBuffers.map((b) => ({
        project_id: projectId,
        scenario_id: scenario.id,
        from_process_id: b.from_process_id ? (idMap.get(b.from_process_id) ?? null) : null,
        to_process_id: b.to_process_id ? (idMap.get(b.to_process_id) ?? null) : null,
        wip_count: b.wip_count,
        buffer_type: b.buffer_type,
        flow_style: b.flow_style,
        x: b.x,
        y: b.y,
      }))
    )
    if (bufferCopyError) {
      redirect(`/editor/${projectId}?error=` + encodeURIComponent(bufferCopyError.message))
    }
  }

  redirect(`/editor/${projectId}?scenario=${scenario.id}`)
}

export async function deleteScenario(projectId: string, scenarioId: string) {
  const supabase = await createClient()
  // FK is ON DELETE CASCADE on both processes.scenario_id and
  // inventory_buffers.scenario_id, so this also removes the scenario's copy.
  const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId)
  if (error) throw new Error(error.message)
  redirect(`/editor/${projectId}`)
}

// FormData-based (like createScenario above) so it can be used directly as
// a <form action={updateScenarioMeta.bind(null, projectId, scenarioId)}>.
export async function updateScenarioMeta(projectId: string, scenarioId: string, formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim()
  const investmentRaw = formData.get('investmentChf') as string | null
  const paybackRaw = formData.get('paybackMonths') as string | null
  const riskLevel = (formData.get('riskLevel') as string | null) || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('scenarios')
    .update({
      ...(name ? { name } : {}),
      investment_chf: investmentRaw ? Number(investmentRaw) : null,
      payback_months: paybackRaw ? Number(paybackRaw) : null,
      risk_level: riskLevel,
    })
    .eq('id', scenarioId)
  if (error) throw new Error(error.message)
  revalidatePath(`/editor/${projectId}`)
  revalidatePath(`/editor/${projectId}/compare`)
}
