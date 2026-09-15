'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

// Aktionspläne zu CAMA-Linien (capacity_actions). Absicherung ist die Policy
// "editors can write capacity actions" (Migration 20260914150000) — die
// Prüfung hier ist die Erklärung, wie bei saveOrgProfile.

function capacityPath(projectId: string, scenarioId: string | null, processId: string): string {
  const params = new URLSearchParams()
  if (scenarioId) params.set('scenario', scenarioId)
  params.set('process', processId)
  return `/editor/${projectId}/capacity?${params.toString()}`
}

/** 1-12 oder null — leer/ungültig heisst "nicht monatsgebunden", kein Fehler. */
function targetMonthOrNull(formData: FormData): number | null {
  const raw = formData.get('target_month')
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

export async function addCapacityAction(
  projectId: string,
  scenarioId: string | null,
  processId: string,
  formData: FormData
) {
  const description = (formData.get('description') as string | null)?.trim()
  const path = capacityPath(projectId, scenarioId, processId)
  if (!description) {
    redirect(`${path}&error=${encodeURIComponent(await tErr('capacityActionDescriptionRequired'))}`)
  }

  const owner = (formData.get('owner') as string | null)?.trim() || null
  const dueDateRaw = formData.get('due_date') as string | null
  const dueDate = dueDateRaw && dueDateRaw.trim() !== '' ? dueDateRaw : null

  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').insert({
    project_id: projectId,
    process_id: processId,
    description: description.slice(0, 500),
    owner: owner ? owner.slice(0, 120) : null,
    due_date: dueDate,
    target_month: targetMonthOrNull(formData),
  })
  if (error) {
    redirect(`${path}&error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/editor/${projectId}/capacity`)
  redirect(path)
}

export async function toggleCapacityActionStatus(
  projectId: string,
  scenarioId: string | null,
  processId: string,
  actionId: string,
  nextStatus: 'open' | 'done'
) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').update({ status: nextStatus }).eq('id', actionId)
  if (error) throw new Error(error.message)

  revalidatePath(`/editor/${projectId}/capacity`)
  redirect(capacityPath(projectId, scenarioId, processId))
}

export async function deleteCapacityAction(
  projectId: string,
  scenarioId: string | null,
  processId: string,
  actionId: string
) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').delete().eq('id', actionId)
  if (error) throw new Error(error.message)

  revalidatePath(`/editor/${projectId}/capacity`)
  redirect(capacityPath(projectId, scenarioId, processId))
}

async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
