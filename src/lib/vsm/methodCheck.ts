import type { ReactNode } from 'react'

/**
 * Ein Methodikbefund am aktuellen Wertstrom.
 *
 * `severity` ist die Rangfolge, nicht nur die Farbe: `critical` heisst, dass
 * eine angezeigte Kennzahl dadurch ihre Aussagekraft verliert; `warning`
 * heisst, dass die Darstellung methodisch unsauber ist, die Zahlen daneben
 * aber stimmen.
 *
 * `title` ist bewusst eine Zeichenkette und kein ReactNode: Er muss ausser im
 * Panel auch ins PDF, und dorthin geht nur Text.
 */
export interface MethodFinding {
  id: string
  severity: 'critical' | 'warning'
  /** Eine Zeile, die im zugeklappten Zustand und auf dem Blatt allein traegt. */
  title: string
  /** Die Begruendung. Wird erst beim Aufklappen gelesen, nicht im PDF. */
  detail: ReactNode
}

const SEVERITY_ORDER: Record<MethodFinding['severity'], number> = {
  critical: 0,
  warning: 1,
}

// Die Zaehlung ("1 Hinweis" / "3 Hinweise") stand frueher als eigene
// Funktion hier. Seit der Mehrsprachigkeit uebernimmt das die
// ICU-Pluralregel in MethodCheck.hintCount — jede Sprache bringt ihre
// eigenen Pluralformen mit, und die sind nicht ueberall zwei.

/**
 * Nach Schwere sortiert, innerhalb einer Stufe in der Reihenfolge der
 * Erzeugung. Ein Black Belt denkt in Rangfolgen und will wissen, was zuerst
 * zaehlt; eine stabile Sortierung sorgt zusaetzlich dafuer, dass Hinweise
 * nicht bei jeder Neuberechnung die Plaetze tauschen.
 */
export function rankFindings(findings: MethodFinding[]): MethodFinding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
