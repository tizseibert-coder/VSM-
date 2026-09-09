'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { deleteProject } from '@/app/[locale]/dashboard/actions'

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
  const t = useTranslations('Dashboard')
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
            ? 'rounded-control border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700'
            : 'rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
        }
      >
        {/* Der Projektname stand frueher in der Beschriftung. Auf einem
            390 px breiten Bildschirm machte das aus dem Knopf ein 371 px
            breites Feld, das in einem `shrink-0`-Formular sitzt und die Zeile
            aus dem Bild schob. Sichtbar gewinnt der Name hier nichts: Er steht
            in derselben Zeile unmittelbar links daneben. Fuer alles, was die
            Zeile nicht sieht, traegt ihn das aria-label oben. */}
        {armed ? t('deleteConfirm') : t('delete')}
      </button>
    </form>
  )
}
