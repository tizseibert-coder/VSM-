import type { ReactNode } from 'react'
import { signInWithGoogle, signInWithApple } from '@/app/auth/oauth-actions'

/**
 * "Mit Apple anmelden" ist ausgeblendet, nicht gelöscht.
 *
 * Der Provider steht in Supabase auf disabled, und ihn zu aktivieren setzt
 * eine Mitgliedschaft im Apple Developer Program voraus (99 €/Jahr) samt
 * Services ID, Schlüssel und einem signierten Client-Secret, das alle sechs
 * Monate neu erzeugt werden muss. Bis das existiert, lief jeder Klick in einen
 * Fehler — für Beta-Tester schlechter als gar kein Button.
 *
 * Zum Aktivieren: hier auf `true` setzen, nachdem der Provider in Supabase
 * eingerichtet ist. Server Action und Button bleiben dafür vollständig
 * erhalten.
 */
const APPLE_SIGN_IN_ENABLED = false

export function OAuthButtons() {
  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-500">oder</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <form action={signInWithGoogle}>
          <OAuthButton icon={<GoogleIcon />} label="Mit Google anmelden" />
        </form>
        {APPLE_SIGN_IN_ENABLED && (
          <form action={signInWithApple}>
            <OAuthButton icon={<AppleIcon />} label="Mit Apple anmelden" />
          </form>
        )}
      </div>
    </>
  )
}

function OAuthButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center gap-2 rounded-control border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      {icon}
      {label}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.5H24v7h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5-5C33.6 6.1 29.1 4.3 24 4.3 12.6 4.3 3.3 13.6 3.3 25s9.3 20.7 20.7 20.7S44.7 36.4 44.7 25c0-1.5-.2-2.9-.5-4.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l5.8 4.2C13.6 15.4 18.4 12 24 12c3.1 0 5.9 1.2 8 3.1l5-5C33.6 6.1 29.1 4.3 24 4.3 16.3 4.3 9.6 8.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.7c5 0 9.5-1.9 12.9-5.1l-6-5c-2 1.4-4.4 2.1-6.9 2.1-5.3 0-9.7-3.4-11.3-8l-5.9 4.5c3.2 6.4 9.9 10.8 17.2 10.8z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.5H24v7h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6 5c-.4.4 6.4-4.7 6.4-13.5 0-1.5-.2-2.9-.5-4.5z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.468 2.164-1.229 2.897-.83.812-2.19 1.44-3.24 1.35-.14-1.086.428-2.24 1.19-2.97.83-.798 2.29-1.4 3.28-1.277zM20.94 17.29c-.29.66-.63 1.29-1.02 1.87-.53.79-1.16 1.68-2 1.68-.74 0-1.05-.49-1.98-.49-.94 0-1.29.49-1.99.49-.83.02-1.5-.85-2.03-1.64-1.44-2.15-2.54-6.08-1.06-8.73.73-1.31 2.05-2.14 3.49-2.16.8-.01 1.55.53 2.05.53.5 0 1.41-.66 2.38-.56.4.02 1.53.16 2.26 1.22-.06.04-1.35.78-1.33 2.33.02 1.85 1.62 2.47 1.64 2.48-.02.05-.26.9-.86 1.79z" />
    </svg>
  )
}
