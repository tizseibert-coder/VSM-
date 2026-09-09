'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Spinner } from './Spinner'

/**
 * Ein Absende-Knopf, der die eigene Rueckmeldung traegt.
 *
 * `useFormStatus()` gilt fuer das umschliessende `<form>` — dieser Knopf
 * muss also innerhalb des Formulars stehen, dessen Absenden er anzeigt.
 * Waehrend die Server Action laeuft, erscheint der Kreis vor der
 * Beschriftung und der Knopf ist gesperrt: Ein zweiter Klick in der Luecke
 * (Netzwerk, Datenbank, bei einem Kauf zusaetzlich Stripe) darf die Handlung
 * nicht doppelt auslosen.
 *
 * Fuer die haeufigen Faelle gedacht — ein Formular, ein Knopf, kein eigener
 * Klick-Abfangen wie bei den zweistufigen Loeschen-Knoepfen. Die brauchen
 * `useFormStatus()` und `<Spinner />` direkt, weil sie ihren eigenen
 * Best-Zustand schon verwalten.
 */
export function SubmitButton({
  children,
  className = '',
  ...props
}: {
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={`inline-flex items-center gap-2 ${className}`}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  )
}
