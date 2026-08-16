import Link from 'next/link'
import { login } from './actions'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { PasswordField } from '@/components/auth/PasswordField'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Anmelden</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Willkommen zurück bei VSM Builder.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              // inputMode blendet auf dem Telefon die Tastatur mit @ und Punkt
              // ein; autoCapitalize/autoCorrect verhindern, dass iOS die
              // Adresse gross schreibt oder zu einem Wort "korrigiert" — beides
              // führte sonst zu einer stillen Fehleingabe beim Anmelden.
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <PasswordField autoComplete="current-password" />
          <button
            formAction={login}
            className="mt-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Anmelden
          </button>
        </form>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Noch kein Konto?{' '}
          <Link href="/signup" className="font-medium text-zinc-950 underline dark:text-zinc-50">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}
