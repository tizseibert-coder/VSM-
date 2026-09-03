import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { login } from './actions'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { PasswordField } from '@/components/auth/PasswordField'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams
  const t = await getTranslations('Login')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-surface border border-black/10 bg-white p-8">
        <h1 className="text-2xl font-semibold text-zinc-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t('subtitle')}</p>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4">
          {/* Reicht das Ziel durch die Anmeldung hindurch — sonst landet
              jemand, der ueber einen Einladungslink kam, im Dashboard und
              muesste den Link erneut suchen. safeNextPath() in der Action
              prueft den Wert, bevor er in ein redirect() geht. */}
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              {t('emailLabel')}
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
              className="mt-1 w-full rounded-control border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <PasswordField autoComplete="current-password" />
          <button
            formAction={login}
            className="mt-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            {t('submit')}
          </button>
        </form>

        <OAuthButtons />

        <p className="mt-6 text-center text-sm text-zinc-600">
          {t('noAccount')}{' '}
          <Link href="/signup" className="font-medium text-zinc-950 underline">
            {t('signupLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
