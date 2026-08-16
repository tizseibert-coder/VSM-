import Link from 'next/link'
import { signup } from './actions'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { PasswordField } from '@/components/auth/PasswordField'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Konto erstellen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Starte mit deiner ersten Wertstromanalyse.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="orgName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Firma / Team (optional)
            </label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              autoComplete="organization"
              placeholder="z. B. Muster AG"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
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
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <PasswordField autoComplete="new-password" minLength={8} />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Mindestens 8 Zeichen.</p>
          </div>
          <button
            formAction={signup}
            className="mt-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Konto erstellen
          </button>
        </form>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Bereits ein Konto?{' '}
          <Link href="/login" className="font-medium text-zinc-950 underline dark:text-zinc-50">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
