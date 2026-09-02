import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Tables } from '@/types/database'
import NewScenarioDisclosure from './NewScenarioDisclosure'

type Scenario = Tables<'scenarios'>

const TYPE_LABEL: Record<string, string> = { A: 'A', B: 'B', C: 'C' }

// Server Component: no client state needed, the "+ Neues Szenario" form is a
// plain <details> disclosure so it works without JS (same low-JS approach as
// the dashboard page's forms).
export default async function ScenarioSwitcher({
  projectId,
  scenarios,
  activeScenarioId,
}: {
  projectId: string
  scenarios: Scenario[]
  activeScenarioId: string | null
}) {
  const t = await getTranslations('Scenario')
  const tabClass = (isActive: boolean) =>
    `rounded-control px-4 py-1.5 text-sm font-medium ${
      isActive
        ? 'bg-brand-600 text-white'
        : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/editor/${projectId}`} className={tabClass(activeScenarioId === null)}>
        {t('currentState')}
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

      <NewScenarioDisclosure projectId={projectId} usedTypes={scenarios.map((s) => s.type)} />
    </div>
  )
}
