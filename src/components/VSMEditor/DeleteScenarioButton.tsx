'use client'

import { useState } from 'react'
import { deleteScenario } from '@/app/editor/[projectId]/scenario-actions'

// Extracted from ScenarioMetaPanel (which stays a plain Server Component)
// for the same reason NewScenarioDisclosure was split out: this needs real
// client state. UX-Audit Phase 7a finding #6 — deleting a scenario used to
// fire on the first click with no confirm/undo, cascading every
// process/buffer row that was copied into it. A second click within the
// same focus session is now required; losing focus resets the arm state.
export default function DeleteScenarioButton({
  projectId,
  scenarioId,
}: {
  projectId: string
  scenarioId: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <form action={deleteScenario.bind(null, projectId, scenarioId)}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirmDelete) {
            e.preventDefault()
            setConfirmDelete(true)
          }
        }}
        onBlur={() => setConfirmDelete(false)}
        className={
          confirmDelete
            ? 'rounded-full border border-red-600 bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700'
            : 'rounded-full border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950'
        }
      >
        {confirmDelete ? 'Wirklich löschen?' : 'Szenario löschen'}
      </button>
    </form>
  )
}
