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
        className="rounded-control border border-dashed border-zinc-400 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
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
        className="rounded-control border border-zinc-400 bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700"
      >
        {buttonLabel}
      </button>
      <form
        action={createScenario.bind(null, projectId)}
        className="absolute z-10 mt-2 flex w-72 flex-col gap-2 rounded-surface border border-zinc-200 bg-white p-4 shadow-lg"
      >
        {sourceScenarioId && <input type="hidden" name="sourceScenarioId" value={sourceScenarioId} />}
        <label className="text-xs font-medium text-zinc-600">
          Typ
          <select
            name="type"
            defaultValue="A"
            className="mt-1 w-full rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-600">
          Name
          <input
            name="name"
            required
            placeholder="z. B. Future State — Pull-System"
            className="mt-1 w-full rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <p className="text-xs text-zinc-500">
          {sourceScenarioId
            ? 'Kopiert dieses Szenario als Startpunkt für die nächste Iteration — danach unabhängig editierbar.'
            : 'Kopiert den aktuellen Ist-Zustand als Startpunkt — danach unabhängig editierbar.'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-control bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Anlegen
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-control px-4 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
