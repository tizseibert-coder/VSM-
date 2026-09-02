// Wertschöpfungs-Klassifizierung (VA/NVA) — wires up the `processes.classification`
// column that has existed since Phase 1 but was never read or written anywhere
// (confirmed dead in the Reifegrad-Benchmark audit). Free-text varchar in the DB,
// no CHECK constraint, so the allowed value set lives here at the app level —
// same pattern as the single-pacemaker rule enforced in actions.ts.

export type ClassificationValue = 'va' | 'nva' | 'necessary_nva'

export interface ClassificationEntry {
  /**
   * Kurzzeichen auf der Prozessbox — bleibt unuebersetzt: VA, NVA und nNVA
   * sind im Englischen wie im Deutschen dieselben Lean-Kuerzel, und auf der
   * Box waere fuer mehr als ein paar Zeichen ohnehin kein Platz.
   */
  marker: string
  /**
   * Schluessel der ausgeschriebenen Beschriftung im Namensraum
   * `Classification` — der Text selbst steht in messages/{de,en}.json.
   */
  labelKey: string
}

export const CLASSIFICATION: Record<ClassificationValue, ClassificationEntry> = {
  va: { marker: 'VA', labelKey: 'va' },
  nva: { marker: 'NVA', labelKey: 'nva' },
  necessary_nva: { marker: 'nNVA', labelKey: 'necessaryNva' },
}

/** Type guard: is this a value the app actually recognizes (vs. null/legacy/garbage)? */
export function isClassificationValue(value: string | null): value is ClassificationValue {
  return value !== null && value in CLASSIFICATION
}

/** The short on-canvas marker for a stored value, or null if unset/unrecognized (no badge shown). */
export function classificationMarker(value: string | null): string | null {
  return isClassificationValue(value) ? CLASSIFICATION[value].marker : null
}
