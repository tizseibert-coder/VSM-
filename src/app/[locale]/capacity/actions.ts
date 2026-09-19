'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import type { TablesInsert } from '@/types/database'

// Linien, ihre Kapazitätsdaten und ihre Aktionspläne — organisationsweit,
// siehe docs/plan-cama-line-module.md. Absicherung ist die jeweilige Policy
// ("editors can write production lines"/"...line capacity"/"...capacity
// actions", Migration 20260914150000) — die Prüfung hier ist die Erklärung,
// wie bei saveOrgProfile.

function canWrite(role: string): boolean {
  return role === 'owner' || role === 'editor'
}

async function requireWriteAccess() {
  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirect('/capacity?error=' + encodeURIComponent(orgResult.error))
  }
  if (!canWrite(orgResult.active.role)) {
    redirect('/capacity?error=' + encodeURIComponent(await tErr('capacityEditorsOnly')))
  }
  return orgResult.active
}

export async function createLine(formData: FormData) {
  const active = await requireWriteAccess()
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect('/capacity?error=' + encodeURIComponent(await tErr('capacityLineNameRequired')))
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('production_lines')
    .insert({ organization_id: active.organizationId, name: name.slice(0, 120) })
    .select('id')
    .single()

  if (error || !data) {
    redirect('/capacity?error=' + encodeURIComponent(error?.message ?? 'unknown'))
  }

  revalidatePath('/capacity')
  redirect(`/capacity?line=${data.id}`)
}

export async function deleteLine(lineId: string) {
  await requireWriteAccess()
  const supabase = await createClient()
  const { error } = await supabase.from('production_lines').delete().eq('id', lineId)
  if (error) {
    redirect('/capacity?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/capacity')
  redirect('/capacity')
}

/** 1-12 oder null — leer/ungültig heisst "nicht monatsgebunden", kein Fehler. */
function targetMonthOrNull(formData: FormData): number | null {
  const raw = formData.get('target_month')
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** Liest zwölf `<prefix>_<monat>`-Felder in ein 12er-Array. Ein leeres/
 *  ungültiges Feld wird zu 0 — dieselbe Konvention wie resolveMonthlyValues
 *  in capacityAnalysis.ts, nur schon beim Einlesen angewendet, damit die
 *  gespeicherten Daten von Anfang an vollständig sind. `null`, wenn *kein*
 *  einziges Feld einen Wert trägt — "noch nicht erfasst" bleibt erfassbar
 *  als eigener Zustand, nicht als zwölf Nullen.
 */
function monthlyArrayFromForm(formData: FormData, prefix: string): number[] | null {
  const values: number[] = []
  let anySet = false
  for (let month = 1; month <= 12; month++) {
    const raw = formData.get(`${prefix}_${month}`)
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (trimmed !== '') anySet = true
    const parsed = trimmed === '' ? 0 : Number(trimmed.replace(',', '.'))
    values.push(Number.isFinite(parsed) ? parsed : 0)
  }
  return anySet ? values : null
}

/**
 * Wie monthlyArrayFromForm, aber ein leeres Feld bleibt `null` statt 0 — für
 * monthly_actual_hours, wo ein noch nicht vergangener oder noch nicht
 * erfasster Monat kein Ist-Wert 0 werden darf, sonst zeigte das Diagramm auf
 * capacity/page.tsx einen unbearbeiteten Monat als "0 Stunden geleistet"
 * statt als offen (siehe capacityAnalysis.ts, calcCamaHoursTrend/
 * resolveMonthlyActualHours). `null` insgesamt nur, wenn *kein einziges*
 * Feld gesetzt ist — derselbe Fall wie bei monthlyArrayFromForm.
 */
function monthlyActualHoursFromForm(formData: FormData): (number | null)[] | null {
  const values: (number | null)[] = []
  let anySet = false
  for (let month = 1; month <= 12; month++) {
    const raw = formData.get(`actual_hours_${month}`)
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (trimmed === '') {
      values.push(null)
      continue
    }
    anySet = true
    const parsed = Number(trimmed.replace(',', '.'))
    values.push(Number.isFinite(parsed) ? parsed : null)
  }
  return anySet ? values : null
}

/**
 * Speichert Name, Taktrate/Bedienerzahl/NEE, Schichtmodell und die
 * Monatsnachfrage einer Linie in einem Zug — ein Formular, zwei
 * Absende-Knöpfe (siehe capacity/page.tsx): `useStretchFactor=false`
 * speichert die Stress-Felder wie eingetragen, `true` überschreibt sie mit
 * Basiswert × 1,2 (der Schneider-Playbook-Vorschlag als Kurzweg, kein fester
 * Zwang — danach bleiben die Werte normal editierbar).
 */
export async function saveLineCapacity(lineId: string, useStretchFactor: boolean, formData: FormData) {
  await requireWriteAccess()

  const name = (formData.get('name') as string | null)?.trim()
  const cycleTimeRaw = (formData.get('cycle_time_minutes') as string | null)?.trim()
  const cycleTime = cycleTimeRaw ? Number(cycleTimeRaw.replace(',', '.')) : NaN
  const operatorCountRaw = (formData.get('operator_count') as string | null)?.trim()
  const operatorCount = operatorCountRaw ? Number(operatorCountRaw) : NaN
  const oeeRaw = (formData.get('oee') as string | null)?.trim()
  const oee = oeeRaw ? Number(oeeRaw.replace(',', '.')) : NaN
  const shiftRaw = formData.get('shift_model')
  const shiftModel = shiftRaw === '1' || shiftRaw === '2' || shiftRaw === '3' ? Number(shiftRaw) : null

  const monthlyDemand = monthlyArrayFromForm(formData, 'demand')
  const monthlyDemandStretch = useStretchFactor
    ? (monthlyDemand ? monthlyDemand.map((value) => Math.round(value * 1.2)) : null)
    : monthlyArrayFromForm(formData, 'stretch')
  const monthlyActualHours = monthlyActualHoursFromForm(formData)

  const supabase = await createClient()

  if (name) {
    const { error } = await supabase.from('production_lines').update({ name: name.slice(0, 120) }).eq('id', lineId)
    if (error) redirect(`/capacity?line=${lineId}&error=${encodeURIComponent(error.message)}`)
  }

  const update: TablesInsert<'line_capacity'> = {
    line_id: lineId,
    cycle_time_minutes: Number.isFinite(cycleTime) && cycleTime > 0 ? cycleTime : null,
    operator_count: Number.isFinite(operatorCount) && operatorCount >= 1 ? Math.round(operatorCount) : 1,
    oee: Number.isFinite(oee) && oee >= 0 && oee <= 100 ? oee : 78,
    shift_model: shiftModel,
    monthly_demand: monthlyDemand,
    monthly_demand_stretch: monthlyDemandStretch,
    monthly_actual_hours: monthlyActualHours,
  }
  const { error } = await supabase.from('line_capacity').upsert(update, { onConflict: 'line_id' })
  if (error) {
    redirect(`/capacity?line=${lineId}&error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/capacity')
  redirect(`/capacity?line=${lineId}&saved=1`)
}

function capacityPath(lineId: string): string {
  return `/capacity?line=${lineId}`
}

export async function addCapacityAction(lineId: string, formData: FormData) {
  await requireWriteAccess()
  const description = (formData.get('description') as string | null)?.trim()
  const path = capacityPath(lineId)
  if (!description) {
    redirect(`${path}&error=${encodeURIComponent(await tErr('capacityActionDescriptionRequired'))}`)
  }

  const owner = (formData.get('owner') as string | null)?.trim() || null
  const dueDateRaw = formData.get('due_date') as string | null
  const dueDate = dueDateRaw && dueDateRaw.trim() !== '' ? dueDateRaw : null

  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').insert({
    line_id: lineId,
    description: description.slice(0, 500),
    owner: owner ? owner.slice(0, 120) : null,
    due_date: dueDate,
    target_month: targetMonthOrNull(formData),
  })
  if (error) {
    redirect(`${path}&error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/capacity')
  redirect(path)
}

export async function toggleCapacityActionStatus(lineId: string, actionId: string, nextStatus: 'open' | 'done') {
  await requireWriteAccess()
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').update({ status: nextStatus }).eq('id', actionId)
  if (error) throw new Error(error.message)

  revalidatePath('/capacity')
  redirect(capacityPath(lineId))
}

export async function deleteCapacityAction(lineId: string, actionId: string) {
  await requireWriteAccess()
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_actions').delete().eq('id', actionId)
  if (error) throw new Error(error.message)

  revalidatePath('/capacity')
  redirect(capacityPath(lineId))
}

async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
