'use client'

import { useState } from 'react'
import { createScenario } from '@/app/editor/[projectId]/scenario-actions'

// Extracted from ScenarioSwitcher (which stays a plain Server Component) so
// this one small piece can hold real open/close state — a native <details>
// only closes when you click the <summary> again, with no visible
// affordance for that, so an "ich wollte das gar nicht anlegen" moment had
// no obvious way out. An explicit "Abbrechen" button needs client state.
//
// sourceScenarioId turns this into the "neue Iteration aus diesem Szenario"
// entry point (docs/plan-future-state-wizard.md #4): omitted, it copies the
// Ist-Zustand exactly as before; passed, it copies that scenario instead, so
// a second pass at the future state can build on the first one rather than
// always restarting from scratch.
export default function NewScenarioDisclosure({
  projectId,
  sourceScenarioId,
  label,
}: {
  projectId: string
  sourceScenarioId?: string
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonLabel = label ?? '+ Neues Szenario'

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-dashed border-zinc-400 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        {buttonLabel}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="rounded-full border border-zinc-400 bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {buttonLabel}
      </button>
      <form
        action={createScenario.bind(null, projectId)}
        className="absolute z-10 mt-2 flex w-72 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        {sourceScenarioId && <input type="hidden" name="sourceScenarioId" value={sourceScenarioId} />}
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Typ
          <select
            name="type"
            defaultValue="A"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Name
          <input
            name="name"
            required
            placeholder="z. B. Future State — Pull-System"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {sourceScenarioId
            ? 'Kopiert dieses Szenario als Startpunkt für die nächste Iteration — danach unabhängig editierbar.'
            : 'Kopiert den aktuellen Ist-Zustand als Startpunkt — danach unabhängig editierbar.'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Anlegen
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
