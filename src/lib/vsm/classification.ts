// Wertschöpfungs-Klassifizierung (VA/NVA) — wires up the `processes.classification`
// column that has existed since Phase 1 but was never read or written anywhere
// (confirmed dead in the Reifegrad-Benchmark audit). Free-text varchar in the DB,
// no CHECK constraint, so the allowed value set lives here at the app level —
// same pattern as the single-pacemaker rule enforced in actions.ts.

export type ClassificationValue = 'va' | 'nva' | 'necessary_nva'

export interface ClassificationEntry {
  /** Full label for the edit-panel dropdown. */
  label: string
  /** Short tag shown on the process box — kept to a few characters so it fits. */
  marker: string
}

export const CLASSIFICATION: Record<ClassificationValue, ClassificationEntry> = {
  va: { label: 'Wertschöpfend (VA)', marker: 'VA' },
  nva: { label: 'Nicht wertschöpfend (NVA)', marker: 'NVA' },
  necessary_nva: { label: 'Notwendig, nicht wertschöpfend', marker: 'nNVA' },
}

/** Type guard: is this a value the app actually recognizes (vs. null/legacy/garbage)? */
export function isClassificationValue(value: string | null): value is ClassificationValue {
  return value !== null && value in CLASSIFICATION
}

/** The short on-canvas marker for a stored value, or null if unset/unrecognized (no badge shown). */
export function classificationMarker(value: string | null): string | null {
  return isClassificationValue(value) ? CLASSIFICATION[value].marker : null
}
