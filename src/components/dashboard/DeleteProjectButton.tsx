'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { deleteProject } from '@/app/[locale]/dashboard/actions'
import { Spinner } from '@/components/ui/Spinner'

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
      <ConfirmButton armed={armed} setArmed={setArmed} projectName={projectName} />
    </form>
  )
}

/**
 * Eigene Komponente, weil `useFormStatus()` den Status des *umschliessenden*
 * Formulars braucht — in derselben Komponente, die das Formular selbst
 * rendert, liefert der Haken nichts. [UX, spuerbare Wartezeit] Ohne die
 * Rueckmeldung hier sah der zweite Klick (der tatsaechliche Loeschvorgang)
 * bis zur Antwort des Servers unveraendert aus wie ein Knopf, der nicht
 * reagiert hat.
 */
function ConfirmButton({
  armed,
  setArmed,
  projectName,
}: {
  armed: boolean
  setArmed: (value: boolean) => void
  projectName: string
}) {
  const t = useTranslations('Dashboard')
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
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
          ? 'inline-flex items-center gap-2 rounded-control border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700'
          : 'inline-flex items-center gap-2 rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
      }
    >
      {pending && <Spinner />}
      {armed ? t('deleteConfirm', { name: projectName }) : t('delete')}
    </button>
  )
}
