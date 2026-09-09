import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeFirstValueStreamProgress,
  PROGRESS_STEPS,
  type ProgressStep,
} from '@/lib/vsm/firstValueStreamProgress'

const STEP_KEY: Record<ProgressStep, string> = {
  project: 'progressStepProject',
  processes: 'progressStepProcesses',
  buffers: 'progressStepBuffers',
  scenario: 'progressStepScenario',
}

const NOTE_KEY: Record<Exclude<ProgressStep, 'project'>, string> = {
  processes: 'progressNoteProcesses',
  buffers: 'progressNoteBuffers',
  scenario: 'progressNoteScenario',
}

/**
 * "Ihr erster Wertstrom — Schritt X von 4", solange genau ein Projekt
 * existiert.
 *
 * [Marketing-Audit 2026-09-07, B3] Nach der Anmeldung landete man im
 * Dashboard mit einem Beispiel- oder leeren Projekt, ohne zu wissen, was ein
 * fertiger Wertstrom bei einem selbst bedeutet, wie weit man ist, oder was
 * als Naechstes drankommt. Robbins: Menschen bleiben dabei, wenn sie
 * Fortschritt *sehen*.
 *
 * Kein neues Zustandsmodell — alle vier Schritte lesen sich aus Zeilen, die
 * ohnehin da sind: Prozesse und Bestaende haengen am Projekt direkt
 * (scenario_id ist dort null fuer den Ist-Zustand, siehe editor/[projectId]),
 * ein Szenario ist eine eigene Zeile in `scenarios`. Die eigentliche
 * Entscheidung (welcher Schritt als naechstes offen ist, wann die Anzeige
 * ganz verschwindet) steckt rein und getestet in
 * lib/vsm/firstValueStreamProgress.ts — hier stehen nur die drei Abfragen
 * und die Darstellung.
 *
 * Nur bei genau einem Projekt sichtbar (siehe Aufrufstelle in
 * dashboard/page.tsx): Das ist der Moment kurz nach der Anmeldung, den der
 * Fund beschreibt. Ab dem zweiten Projekt ist die Aktivierungsphase vorbei —
 * eine Organisation mit fuenf laufenden Wertstroemen braucht keine Anleitung
 * mehr, welcher der "erste" ist.
 */
export default async function FirstValueStreamProgress({ projectId }: { projectId: string }) {
  const supabase = await createClient()

  const [{ count: processCount }, { count: bufferCount }, { count: scenarioCount }] =
    await Promise.all([
      supabase
        .from('processes')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .is('scenario_id', null),
      supabase
        .from('inventory_buffers')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .is('scenario_id', null),
      supabase
        .from('scenarios')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId),
    ])

  const progress = computeFirstValueStreamProgress({
    processCount: processCount ?? 0,
    bufferCount: bufferCount ?? 0,
    scenarioCount: scenarioCount ?? 0,
  })

  // null heisst: ein Szenario steht bereits — der Punkt, an dem der Nutzer
  // den Wert erlebt hat und zugleich die kostenlose Stufe an ihre Grenze
  // stoesst. Der bestehende Tarifhinweis im Streifen darueber uebernimmt von
  // hier; diese Anzeige hat ihren Zweck erfuellt.
  if (!progress) return null

  const t = await getTranslations('Dashboard')

  return (
    <Link
      href={`/editor/${projectId}`}
      className="mt-6 block rounded-surface border border-zinc-200 bg-white px-5 py-4 hover:border-brand-300"
    >
      <p className="text-sm font-medium text-zinc-950">
        {t('progressTitle', { step: progress.currentStep })}
      </p>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {PROGRESS_STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span aria-hidden className={progress.done[step] ? 'text-brand-600' : 'text-zinc-300'}>
              {progress.done[step] ? '✓' : '○'}
            </span>
            <span className={progress.done[step] ? 'text-zinc-950' : 'text-zinc-500'}>
              {t(STEP_KEY[step])}
            </span>
            {i < PROGRESS_STEPS.length - 1 && (
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
            )}
          </li>
        ))}
      </ol>
      {progress.nextStep && (
        <p className="mt-2 text-xs text-zinc-600">{t(NOTE_KEY[progress.nextStep])}</p>
      )}
    </Link>
  )
}
