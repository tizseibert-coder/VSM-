'use client'

import { useState } from 'react'
import { deleteProject } from '@/app/dashboard/actions'

// Zweistufig, weil unwiderruflich: der erste Klick schaltet scharf, der zweite
// loescht. Blur setzt zurueck. Dasselbe Muster wie DeleteScenarioButton — ein
// eigener Dialog waere hier schwerer zu bedienen, nicht sicherer.
//
// Der Projektname steht bewusst im scharfen Zustand: in einer Liste mehrerer
// VSMs ist "Wirklich loeschen?" allein keine Bestaetigung dessen, was man
// tatsaechlich trifft.
export default function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const [armed, setArmed] = useState(false)

  return (
    <form action={deleteProject.bind(null, projectId)} className="shrink-0">
      <button
        type="submit"
        aria-label={armed ? `${projectName} endgueltig loeschen` : `${projectName} loeschen`}
        onClick={(e) => {
          if (!armed) {
            e.preventDefault()
            setArmed(true)
          }
        }}
        onBlur={() => setArmed(false)}
        className={
          armed
            ? 'rounded-full border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700'
            : 'rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-900 dark:hover:bg-red-950 dark:hover:text-red-400'
        }
      >
        {armed ? `„${projectName}" wirklich löschen?` : 'Löschen'}
      </button>
    </form>
  )
}
