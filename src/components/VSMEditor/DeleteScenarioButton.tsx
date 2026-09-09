'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { deleteScenario } from '@/app/[locale]/editor/[projectId]/scenario-actions'
import { Spinner } from '@/components/ui/Spinner'

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
      <ConfirmButton confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
    </form>
  )
}

/** Eigene Komponente, weil `useFormStatus()` den Status des umschliessenden
 *  Formulars braucht — im selben Rumpf, der das Formular rendert, liefert
 *  der Haken nichts (siehe DeleteProjectButton.tsx, dasselbe Muster). */
function ConfirmButton({
  confirmDelete,
  setConfirmDelete,
}: {
  confirmDelete: boolean
  setConfirmDelete: (value: boolean) => void
}) {
  const t = useTranslations('Scenario')
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirmDelete) {
          e.preventDefault()
          setConfirmDelete(true)
        }
      }}
      onBlur={() => setConfirmDelete(false)}
      className={
        confirmDelete
          ? 'inline-flex items-center gap-2 rounded-control border border-red-600 bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700'
          : 'inline-flex items-center gap-2 rounded-control border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50'
      }
    >
      {pending && <Spinner />}
      {confirmDelete ? t('confirmDelete') : t('deleteScenario')}
    </button>
  )
}
