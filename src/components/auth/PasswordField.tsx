'use client'

import { useState } from 'react'

/**
 * Passwortfeld mit Auge zum Einblenden.
 *
 * Eigene Client-Komponente, weil login/page.tsx und signup/page.tsx Server
 * Components sind und den Umschaltzustand nicht halten können. Das Feld heisst
 * weiterhin `password`, die Server Actions bleiben unverändert.
 *
 * `autoComplete` ist bewusst ein Pflicht-Prop statt eines Standardwerts: beim
 * Anmelden muss `current-password` stehen, beim Registrieren `new-password` —
 * verwechselt man das, bietet der Passwortmanager auf dem Telefon beim
 * Registrieren das alte Passwort an statt ein neues vorzuschlagen.
 */
export function PasswordField({
  autoComplete,
  minLength,
  label = 'Passwort',
}: {
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  label?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          // Ohne diese drei schlägt iOS beim Einblenden des Passworts
          // Autokorrektur und Grossschreibung vor und verändert die Eingabe.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-300 py-2 pl-3 pr-11 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          // type="button" ist zwingend — ein Button ohne type gilt in einem
          // Formular als submit und würde die Anmeldung auslösen.
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
