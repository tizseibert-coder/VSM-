import type { Tables } from '@/types/database'
import { deleteScenario, updateScenarioMeta } from '@/app/editor/[projectId]/scenario-actions'

type Scenario = Tables<'scenarios'>

// Business-case fields that can't be derived from the canvas geometry
// (investment cost, payback, risk) — the WIP-reduction/lead-time numbers
// themselves are now computed live from the copied buffers, shown on the
// /compare page, so there's no separate manual "estimated %" field anymore.
export default function ScenarioMetaPanel({
  projectId,
  scenario,
}: {
  projectId: string
  scenario: Scenario
}) {
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <form action={updateScenarioMeta.bind(null, projectId, scenario.id)} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sm-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
          </label>
          <input
            id="sm-name"
            name="name"
            defaultValue={scenario.name ?? ''}
            className="mt-1 w-48 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="sm-investment" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Investition (CHF)
          </label>
          <input
            id="sm-investment"
            name="investmentChf"
            type="number"
            min={0}
            defaultValue={scenario.investment_chf ?? ''}
            className="mt-1 w-32 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="sm-payback" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Payback (Monate)
          </label>
          <input
            id="sm-payback"
            name="paybackMonths"
            type="number"
            min={0}
            step="0.1"
            defaultValue={scenario.payback_months ?? ''}
            className="mt-1 w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="sm-risk" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Risiko
          </label>
          <select
            id="sm-risk"
            name="riskLevel"
            defaultValue={scenario.risk_level ?? ''}
            className="mt-1 w-32 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">–</option>
            <option value="low">Niedrig</option>
            <option value="medium">Mittel</option>
            <option value="high">Hoch</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Speichern
        </button>
      </form>

      <form action={deleteScenario.bind(null, projectId, scenario.id)}>
        <button
          type="submit"
          className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Szenario löschen
        </button>
      </form>
    </div>
  )
}
