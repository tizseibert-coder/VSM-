'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  updateAnnualThroughput,
  updateAvailableMinutes,
  setBufferWip,
  updateProcess,
  updateHasHeijunka,
  updatePitchMinutes,
  updateKaizenNote,
} from '../actions'

// Thin FormData-parsing wrappers so the wizard's Server-Component forms can
// bind straight to projectId/scenarioId without needing client JS — same
// low-JS pattern as ScenarioMetaPanel's <form action={...bind...}>. No new
// business logic lives here; each wrapper just unpacks the relevant field(s)
// and calls the existing, already-tested action from actions.ts.

function backToQuestion(projectId: string, scenarioId: string, questionId: number): never {
  redirect(`/editor/${projectId}/future-state/${questionId}?scenario=${scenarioId}`)
}

function parsePositiveNumber(value: FormDataEntryValue | null): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function submitTaktTime(projectId: string, scenarioId: string, formData: FormData) {
  await updateAnnualThroughput(projectId, parsePositiveNumber(formData.get('annualThroughput')))
  const availableMinutesPerDay = parsePositiveNumber(formData.get('availableMinutesPerDay'))
  if (availableMinutesPerDay !== null) {
    await updateAvailableMinutes(projectId, availableMinutesPerDay)
  }
  backToQuestion(projectId, scenarioId, 1)
}

// Shared by Q2 (terminal buffer) and Q3/Q4 (internal connections) — a
// question step never needs the full buffer-edit panel, just the type + WIP
// for one specific gap in the chain.
export async function submitBuffer(
  projectId: string,
  scenarioId: string,
  questionId: number,
  fromProcessId: string | null,
  toProcessId: string | null,
  formData: FormData
) {
  const bufferType = (formData.get('bufferType') as string | null) ?? 'standard'
  const wipCount = Number(formData.get('wipCount')) || 0
  await setBufferWip(projectId, scenarioId, { fromProcessId, toProcessId, wipCount, bufferType })
  backToQuestion(projectId, scenarioId, questionId)
}

// Sets processId as the pacemaker without disturbing its other fields —
// updateProcess only accepts its full input shape, so this fetches the
// current row first and resubmits it unchanged except for isPacemaker.
export async function submitPacemaker(projectId: string, scenarioId: string, formData: FormData) {
  const processId = formData.get('processId') as string
  const supabase = await createClient()
  const { data: proc, error } = await supabase.from('processes').select('*').eq('id', processId).single()
  if (error || !proc) throw new Error(error?.message ?? 'Prozess nicht gefunden.')

  await updateProcess(projectId, processId, {
    name: proc.name,
    cycleTime: proc.cycle_time,
    oee: proc.oee,
    operatorCount: proc.operator_count,
    changeoverTime: proc.changeover_time,
    isPacemaker: true,
    classification: proc.classification,
  })
  backToQuestion(projectId, scenarioId, 5)
}

export async function submitHeijunka(projectId: string, scenarioId: string, processId: string, formData: FormData) {
  await updateHasHeijunka(projectId, processId, formData.get('hasHeijunka') === 'on')
  backToQuestion(projectId, scenarioId, 6)
}

export async function submitPitch(projectId: string, scenarioId: string, formData: FormData) {
  await updatePitchMinutes(projectId, parsePositiveNumber(formData.get('pitchMinutes')))
  backToQuestion(projectId, scenarioId, 7)
}

export async function submitKaizenNote(projectId: string, scenarioId: string, processId: string, formData: FormData) {
  await updateKaizenNote(projectId, processId, formData.get('kaizenNote') as string | null)
  backToQuestion(projectId, scenarioId, 8)
}
