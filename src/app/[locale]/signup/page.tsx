import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { signup } from './actions'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { PasswordField } from '@/components/auth/PasswordField'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { pageMetadata, SITE_NAME } from '@/lib/seo/site'

/**
 * Diese Seite gehoert in den Index — sie ist regelmaessig das Ziel, wenn
 * jemand den Produktnamen zusammen mit "Anmeldung" sucht. Was sie braucht,
 * ist die kanonische Adresse: Ohne sie waeren `/{locale}/signup` und
 * `/{locale}/signup?next=…` fuer eine Suchmaschine zwei Seiten.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Signup' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/signup',
    title: t('title'),
    description: t('subtitle'),
    ogLocale: tMeta('ogLocale'),
  })
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; from?: string }>
}) {
  const { error, next, from } = await searchParams
  const t = await getTranslations('Signup')
  const tNav = await getTranslations('Nav')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* [Marketing-Audit 2026-09-07, C1] Diese Seite hatte keinen Ausgang
            ausser der Zurueck-Taste: kein Logo-Link, kein Weg zur Demo. Wer
            hier zoegert, soll die Demo noch pruefen koennen, statt den Tab zu
            schliessen und nie zurueckzukommen. */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <Link
            href="/"
            className="font-semibold uppercase tracking-widest text-brand-600 hover:underline"
          >
            {SITE_NAME}
          </Link>
          <Link href="/demo" className="font-medium text-zinc-600 hover:text-brand-600 hover:underline">
            {tNav('demo')}
          </Link>
        </div>
        <div className="rounded-surface border border-black/10 bg-white p-8">
          <h1 className="text-2xl font-semibold text-zinc-950">{t('title')}</h1>
          {/* [Marketing-Audit 2026-09-07, A2/C3] Wer aus der Demo kommt, liest
              hier, was er behaelt — statt der allgemeinen Zeile, die an der
              Stelle mit der hoechsten Abbruchquote nichts erklaert. Der
              Zwischenstand liegt in seinem Browser; das Dashboard bietet die
              Uebernahme danach an. Die allgemeine Zeile selbst war bis hierher
              „Beginnen Sie mit Ihrer ersten Wertstromanalyse." — inhaltsleer
              an genau der Stelle, an der jemand noch entscheidet, ob sich das
              Ausfuellen lohnt. Jetzt steht dort, was tatsaechlich zutrifft:
              kostenlos, ohne Kreditkarte (FREE braucht keine Zahlung, siehe
              lib/billing/plans.ts), und was er bekommt, ist kein leeres
              Formular, sondern ein rechnendes Werkzeug. */}
          <p className="mt-1 text-sm text-zinc-600">
            {from === 'demo' ? t('subtitleFromDemo') : t('subtitle')}
          </p>

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
              <label htmlFor="orgName" className="text-sm font-medium text-zinc-700">
                {t('orgLabel')}
              </label>
              <input
                id="orgName"
                name="orgName"
                type="text"
                autoComplete="organization"
                placeholder={t('orgPlaceholder')}
                className="mt-1 w-full rounded-control border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
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
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 w-full rounded-control border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <PasswordField autoComplete="new-password" minLength={8} />
              <p className="mt-1 text-xs text-zinc-500">{t('passwordHint')}</p>
            </div>
            <SubmitButton
              formAction={signup}
              className="mt-2 justify-center rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              {t('submit')}
            </SubmitButton>
          </form>

          <OAuthButtons />

          <p className="mt-6 text-center text-sm text-zinc-600">
            {t('hasAccount')}{' '}
            <Link href="/login" className="font-medium text-zinc-950 underline">
              {t('loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
