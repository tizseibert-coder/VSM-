import Link from 'next/link'
import type { Tables } from '@/types/database'
import { createScenario } from '@/app/editor/[projectId]/scenario-actions'

type Scenario = Tables<'scenarios'>

const TYPE_LABEL: Record<string, string> = { A: 'A', B: 'B', C: 'C' }

// Server Component: no client state needed, the "+ Neues Szenario" form is a
// plain <details> disclosure so it works without JS (same low-JS approach as
// the dashboard page's forms).
export default function ScenarioSwitcher({
  projectId,
  scenarios,
  activeScenarioId,
}: {
  projectId: string
  scenarios: Scenario[]
  activeScenarioId: string | null
}) {
  const tabClass = (isActive: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${
      isActive
        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950'
        : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/editor/${projectId}`} className={tabClass(activeScenarioId === null)}>
        Ist-Zustand
      </Link>
      {scenarios.map((scenario) => (
        <Link
          key={scenario.id}
          href={`/editor/${projectId}?scenario=${scenario.id}`}
          className={tabClass(activeScenarioId === scenario.id)}
        >
          {TYPE_LABEL[scenario.type ?? ''] ?? '?'} · {scenario.name}
        </Link>
      ))}

      <details className="relative">
        <summary className="cursor-pointer list-none rounded-full border border-dashed border-zinc-400 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-900">
          + Neues Szenario
        </summary>
        <form
          action={createScenario.bind(null, projectId)}
          className="absolute z-10 mt-2 flex w-72 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
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
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Kopiert den aktuellen Ist-Zustand als Startpunkt — danach unabhängig editierbar.
          </p>
          <button
            type="submit"
            className="mt-1 rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Anlegen
          </button>
        </form>
      </details>
    </div>
  )
}
