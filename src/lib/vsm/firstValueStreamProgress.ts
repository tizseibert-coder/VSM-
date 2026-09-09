/**
 * Reine Ableitung des Aktivierungsfortschritts aus drei Zeilenzahlen.
 *
 * Ausgelagert aus der Komponente, damit sich die eigentliche Entscheidung
 * ohne Supabase-Client und ohne Netzwerk testen laesst — dieselbe Trennung
 * wie bei `resolveSubscriptionOutcome` in lib/billing/stripe.ts.
 */

export type ProgressStep = 'project' | 'processes' | 'buffers' | 'scenario'

/** Feste Reihenfolge, auch fuer die Anzeige. */
export const PROGRESS_STEPS: readonly ProgressStep[] = [
  'project',
  'processes',
  'buffers',
  'scenario',
]

export type ProgressCounts = {
  /** Prozesse am Projekt, ausserhalb eines Szenarios (scenario_id ist null). */
  processCount: number
  /** Bestaende am Projekt, ausserhalb eines Szenarios. */
  bufferCount: number
  /** Zeilen in `scenarios` fuer das Projekt — jede davon ist ein
   *  Future-State-Szenario, der Ist-Zustand selbst steht nicht dort. */
  scenarioCount: number
}

export type FirstValueStreamProgress = {
  done: Record<ProgressStep, boolean>
  /** 1 bis 3 — die Anzahl der erledigten Schritte, fuer "Schritt X von 4"
   *  (siehe Beispieltext im Fund: zwei Haken stehen neben "Schritt 2"). Nie
   *  4, weil die Funktion ab dem vierten Haken null liefert. */
  currentStep: number
  /** Der naechste noch offene Schritt, oder null, wenn alle vier stehen. */
  nextStep: Exclude<ProgressStep, 'project'> | null
}

/**
 * Ob die Anzeige ueberhaupt etwas zu sagen hat.
 *
 * `false` sobald ein Szenario steht: Das ist der Punkt, an dem der Nutzer
 * den Wert erlebt hat (und zugleich die Grenze der kostenlosen Stufe) —
 * danach ist die naechste Handlung nicht mehr "einen Schritt weiter im
 * ersten Wertstrom", sondern eine andere Anzeige uebernimmt.
 */
export function computeFirstValueStreamProgress(
  counts: ProgressCounts
): FirstValueStreamProgress | null {
  const done: Record<ProgressStep, boolean> = {
    project: true,
    processes: counts.processCount > 0,
    buffers: counts.bufferCount > 0,
    scenario: counts.scenarioCount > 0,
  }

  if (done.scenario) return null

  // Der Beispieltext im Fund zeigt zwei Haken ("Projekt angelegt",
  // "Prozesse erfasst") neben "Schritt 2 von 4" — die Zaehlung ist also die
  // Anzahl erledigter Schritte, nicht die Nummer des naechsten offenen.
  const doneCount = PROGRESS_STEPS.filter((step) => done[step]).length
  const nextStep = PROGRESS_STEPS.find((step) => !done[step]) as
    | Exclude<ProgressStep, 'project'>
    | undefined

  return {
    done,
    currentStep: doneCount,
    nextStep: nextStep ?? null,
  }
}
