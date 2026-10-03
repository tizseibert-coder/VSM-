// Tagesplanung — der gefuehrte Tagesabschluss.
//
// Vier Leitfragen, je „Ja" (ok) oder „Abweichung" (warn); bei Abweichung ist
// ein Kommentar Pflicht. Abgeschlossen ist ein Tag erst, wenn alle vier
// beantwortet sind *und* ein Kuerzel eingetragen ist — wie reflexionComplete
// im Vorgaengertool, nur dass das Kuerzel dort an anderer Stelle geprueft
// wurde. Die Datenbank prueft das Kuerzel zusaetzlich
// (pp_reflections_closed_needs_kuerzel).

export const DIMENSIONS = ['d1', 'd2', 'd3', 'd4'] as const
export type Dimension = (typeof DIMENSIONS)[number]

export interface DimensionAnswer {
  status: 'ok' | 'warn' | null
  comment?: string
}

export type ReflectionAnswers = Partial<Record<Dimension, DimensionAnswer>>

export function isAnswered(answer: DimensionAnswer | undefined): boolean {
  if (!answer || answer.status === null) return false
  return answer.status === 'ok' || (answer.comment ?? '').trim() !== ''
}

/** Fortschritt fuer den Score-Balken, z. B. 3 von 4. */
export function reflectionScore(answers: ReflectionAnswers): number {
  return DIMENSIONS.filter((d) => isAnswered(answers[d])).length
}

export type CloseCheck = { ok: true } | { ok: false; missing: Dimension[]; kuerzelMissing: boolean }

export function canCloseDay(answers: ReflectionAnswers, kuerzel: string | null | undefined): CloseCheck {
  const missing = DIMENSIONS.filter((d) => !isAnswered(answers[d]))
  const kuerzelMissing = (kuerzel ?? '').trim() === ''
  return missing.length === 0 && !kuerzelMissing ? { ok: true } : { ok: false, missing, kuerzelMissing }
}
