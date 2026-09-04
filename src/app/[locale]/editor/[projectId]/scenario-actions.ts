'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loadPlan } from '@/lib/billing/entitlement'
import { quota } from '@/lib/billing/plans'

// Creates a new Future-State scenario by deep-copying a source state's
// processes + inventory_buffers into fresh rows tied to the new scenario —
// "volle Zustands-Duplikation": a scenario is a full, independently editable
// VSM state, not a delta against the current one. sourceScenarioId is
// optional (falls back to the Ist-Zustand, i.e. scenario_id IS NULL, exactly
// as before) — passing an existing scenario's id here is what makes "neue
// Iteration aus diesem Szenario" possible (see docs/plan-future-state-wizard.md
// #4): the iteration builds on the previous Soll-Zustand instead of always
// restarting from the Ist-Zustand.
export async function createScenario(projectId: string, formData: FormData) {
  const type = formData.get('type') as string | null
  const name = (formData.get('name') as string | null)?.trim()
  const sourceScenarioId = (formData.get('sourceScenarioId') as string | null) || null

  if (!type || !['A', 'B', 'C'].includes(type) || !name) {
    redirect(`/editor/${projectId}?error=` + encodeURIComponent(await tErr('scenarioTypeAndName')))
  }

  const supabase = await createClient()

  // Tarifgrenze fuer Szenarien je Projekt. Sie haengt an der Organisation des
  // Projekts, nicht am Projekt selbst — deshalb der Umweg ueber `projects`.
  const limitError = await scenarioLimitError(projectId)
  if (limitError) {
    redirect(`/editor/${projectId}?error=` + encodeURIComponent(limitError))
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .insert({ project_id: projectId, type, name, parent_scenario_id: sourceScenarioId })
    .select('id')
    .single()
  if (scenarioError || !scenario) {
    redirect(
      `/editor/${projectId}?error=` +
        encodeURIComponent(scenarioError?.message ?? await tErr('scenarioCreate'))
    )
  }

  let sourceProcessesQuery = supabase.from('processes').select('*').eq('project_id', projectId)
  sourceProcessesQuery = sourceScenarioId
    ? sourceProcessesQuery.eq('scenario_id', sourceScenarioId)
    : sourceProcessesQuery.is('scenario_id', null)
  const { data: sourceProcesses, error: processesError } = await sourceProcessesQuery.order('created_at', {
    ascending: true,
  })
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
          encodeURIComponent(copyError?.message ?? await tErr('scenarioCopyProcesses'))
      )
    }
    for (const cp of copiedProcesses ?? []) {
      if (cp.origin_process_id) idMap.set(cp.origin_process_id, cp.id)
    }
  }

  let sourceBuffersQuery = supabase.from('inventory_buffers').select('*').eq('project_id', projectId)
  sourceBuffersQuery = sourceScenarioId
    ? sourceBuffersQuery.eq('scenario_id', sourceScenarioId)
    : sourceBuffersQuery.is('scenario_id', null)
  const { data: sourceBuffers, error: buffersError } = await sourceBuffersQuery
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
        kanban_type: b.kanban_type,
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

/** Die Szenariengrenze des Tarifs als fertige Meldung, oder null. */
async function scenarioLimitError(projectId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return null

  const plan = await loadPlan(project.organization_id)
  if (!plan.enforced) return null

  const { count } = await supabase
    .from('scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const scenarios = quota(count ?? 0, plan.limits.maxScenariosPerProject)
  if (scenarios.allowed) return null

  const t = await getTranslations('Errors')
  return t('planScenarioLimit', { limit: scenarios.limit ?? 0, tier: plan.tier })
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
