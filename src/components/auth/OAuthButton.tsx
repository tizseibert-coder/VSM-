'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Eigene Datei statt einer Hilfsfunktion in OAuthButtons.tsx: `useFormStatus`
 * braucht eine Client-Komponente, und OAuthButtons.tsx bleibt bewusst eine
 * einfache Server-Komponente (sie liest nur Uebersetzungen). Der Knopf selbst
 * ist der einzige Teil, der wissen muss, ob sein Formular gerade unterwegs
 * ist — bei OAuth zusaetzlich zur eigenen Antwort noch der Sprung zu Google
 * bzw. Apple und zurueck, also eine sichtbare Weile.
 */
export function OAuthButton({ icon, label }: { icon: ReactNode; label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-control border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-70"
    >
      {pending ? <Spinner /> : icon}
      {label}
    </button>
  )
}
