'use server'

import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
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
import { redirectLocalized } from '@/lib/nav/localeRedirect'

// Thin FormData-parsing wrappers so the wizard's Server-Component forms can
// bind straight to projectId/scenarioId without needing client JS — same
// low-JS pattern as ScenarioMetaPanel's <form action={...bind...}>. No new
// business logic lives here; each wrapper just unpacks the relevant field(s)
// and calls the existing, already-tested action from actions.ts.

// `saved=1` drives the "Gespeichert" confirmation banner on the question
// page — the wizard had no save feedback at all before, silently redirecting
// back to the same question after a submit made it unclear whether anything
// actually happened.
// Die Sprache wird durchgereicht statt hier geholt: Diese Funktion kehrt
// nie zurueck und darf deshalb nicht `async` werden — ein Aufrufer, der das
// `await` vergaesse, wuerde stillschweigend weiterlaufen statt umzuleiten.
function backToQuestion(
  projectId: string,
  scenarioId: string,
  questionId: number,
  locale: Locale
): never {
  redirectLocalized(
    `/editor/${projectId}/future-state/${questionId}?scenario=${scenarioId}&saved=1`,
    locale
  )
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
  backToQuestion(projectId, scenarioId, 1, await getLocale())
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
  // Continuous flow has no buffer by definition, so it carries no WIP. The
  // rule itself now lives in setBufferWip, which enforces it for the canvas
  // panel too; what stays here is only the parsing, because Q3's checkbox form
  // doesn't ask for a WIP value at all and Number(null) would be 0 anyway.
  const wipCount = Number(formData.get('wipCount')) || 0
  await setBufferWip(projectId, scenarioId, { fromProcessId, toProcessId, wipCount, bufferType })
  backToQuestion(projectId, scenarioId, questionId, await getLocale())
}

// Sets processId as the pacemaker without disturbing its other fields —
// updateProcess only accepts its full input shape, so this fetches the
// current row first and resubmits it unchanged except for isPacemaker.
export async function submitPacemaker(projectId: string, scenarioId: string, formData: FormData) {
  const processId = formData.get('processId') as string
  const supabase = await createClient()
  const { data: proc, error } = await supabase.from('processes').select('*').eq('id', processId).single()
  if (error || !proc) throw new Error(error?.message ?? await tErr('processNotFound'))

  await updateProcess(projectId, processId, {
    name: proc.name,
    cycleTime: proc.cycle_time,
    oee: proc.oee,
    operatorCount: proc.operator_count,
    changeoverTime: proc.changeover_time,
    isPacemaker: true,
    classification: proc.classification,
  })
  backToQuestion(projectId, scenarioId, 5, await getLocale())
}

export async function submitHeijunka(projectId: string, scenarioId: string, processId: string, formData: FormData) {
  await updateHasHeijunka(projectId, processId, formData.get('hasHeijunka') === 'on')
  backToQuestion(projectId, scenarioId, 6, await getLocale())
}

export async function submitPitch(projectId: string, scenarioId: string, formData: FormData) {
  await updatePitchMinutes(projectId, parsePositiveNumber(formData.get('pitchMinutes')))
  backToQuestion(projectId, scenarioId, 7, await getLocale())
}

export async function submitKaizenNote(projectId: string, scenarioId: string, processId: string, formData: FormData) {
  await updateKaizenNote(projectId, processId, formData.get('kaizenNote') as string | null)
  backToQuestion(projectId, scenarioId, 8, await getLocale())
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
