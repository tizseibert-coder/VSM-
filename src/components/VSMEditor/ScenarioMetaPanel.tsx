import type { Tables } from '@/types/database'
import { updateScenarioMeta } from '@/app/[locale]/editor/[projectId]/scenario-actions'
import DeleteScenarioButton from './DeleteScenarioButton'
import NewScenarioDisclosure from './NewScenarioDisclosure'
import { buttonPrimary } from '@/components/ui/buttons'

type Scenario = Tables<'scenarios'>

// Business-case fields that can't be derived from the canvas geometry
// (investment cost, payback, risk) — the WIP-reduction/lead-time numbers
// themselves are now computed live from the copied buffers, shown on the
// /compare page, so there's no separate manual "estimated %" field anymore.
export default function ScenarioMetaPanel({
  projectId,
  scenario,
  usedTypes,
}: {
  projectId: string
  scenario: Scenario
  /** Alle Szenario-Typen des Projekts — Vorbelegung im Iterations-Dropdown. */
  usedTypes: (string | null)[]
}) {
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-surface border border-zinc-200 p-4">
      <form action={updateScenarioMeta.bind(null, projectId, scenario.id)} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sm-name" className="block text-xs font-medium text-zinc-600">
            Name
          </label>
          <input
            id="sm-name"
            name="name"
            defaultValue={scenario.name ?? ''}
            className="mt-1 w-48 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="sm-investment" className="block text-xs font-medium text-zinc-600">
            Investition (CHF)
          </label>
          <input
            id="sm-investment"
            name="investmentChf"
            type="number"
            min={0}
            defaultValue={scenario.investment_chf ?? ''}
            className="mt-1 w-32 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="sm-payback" className="block text-xs font-medium text-zinc-600">
            Payback (Monate)
          </label>
          <input
            id="sm-payback"
            name="paybackMonths"
            type="number"
            min={0}
            step="0.1"
            defaultValue={scenario.payback_months ?? ''}
            className="mt-1 w-28 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="sm-risk" className="block text-xs font-medium text-zinc-600">
            Risiko
          </label>
          <select
            id="sm-risk"
            name="riskLevel"
            defaultValue={scenario.risk_level ?? ''}
            className="mt-1 w-32 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">–</option>
            <option value="low">Niedrig</option>
            <option value="medium">Mittel</option>
            <option value="high">Hoch</option>
          </select>
        </div>
        <button
          type="submit"
          className={buttonPrimary}
        >
          Speichern
        </button>
      </form>

      <NewScenarioDisclosure
        projectId={projectId}
        sourceScenarioId={scenario.id}
        label="+ Neue Iteration"
        usedTypes={usedTypes}
      />
      <DeleteScenarioButton projectId={projectId} scenarioId={scenario.id} />
    </div>
  )
}
