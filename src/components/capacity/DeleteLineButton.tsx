'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { deleteLine } from '@/app/[locale]/capacity/actions'
import { Spinner } from '@/components/ui/Spinner'

// Zweistufig wie DeleteProjectButton: der erste Klick schaltet scharf, der
// zweite löscht. Zusätzlich zum Namen zeigt der scharfe Zustand hier, wie
// viele VSM-Prozessboxen die Verknüpfung verlieren würden — das Löschen
// selbst ist ungefährlich (die Boxen bleiben gültig, siehe processes.line_id
// ON DELETE SET NULL), aber "still eine Verknüpfung verlieren" verdient eine
// Warnung, die eine reine Namensbestätigung nicht gäbe.
export default function DeleteLineButton({
  lineId,
  lineName,
  linkedProcessCount,
}: {
  lineId: string
  lineName: string
  linkedProcessCount: number
}) {
  const [armed, setArmed] = useState(false)

  return (
    <form action={deleteLine.bind(null, lineId)}>
      <ConfirmButton armed={armed} setArmed={setArmed} lineName={lineName} linkedProcessCount={linkedProcessCount} />
    </form>
  )
}

function ConfirmButton({
  armed,
  setArmed,
  lineName,
  linkedProcessCount,
}: {
  armed: boolean
  setArmed: (value: boolean) => void
  lineName: string
  linkedProcessCount: number
}) {
  const t = useTranslations('Capacity')
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
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
      {armed
        ? linkedProcessCount > 0
          ? t('deleteLineConfirmLinked', { name: lineName, count: linkedProcessCount })
          : t('deleteLineConfirm', { name: lineName })
        : t('deleteLine')}
    </button>
  )
}
