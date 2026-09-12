import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { confirmNewsletter } from '@/lib/crm/newsletter'

/** Nur die Zuordnung Ergebnis -> Uebersetzungsschluessel; die Saetze stehen
 *  im Namensraum `NewsletterConfirm`. Dieselbe Bauart wie STATUS_KEY auf der
 *  Einladungsseite (invite/[token]/page.tsx). */
const OUTCOME_KEY: Record<string, { title: string; body: string }> = {
  confirmed: { title: 'confirmedTitle', body: 'confirmedBody' },
  already: { title: 'confirmedTitle', body: 'alreadyBody' },
  expired: { title: 'expiredTitle', body: 'expiredBody' },
  invalid: { title: 'invalidTitle', body: 'invalidBody' },
  not_configured: { title: 'invalidTitle', body: 'invalidBody' },
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const t = await getTranslations('NewsletterConfirm')
  const { token } = await searchParams

  // Ein Klick soll den Link verbrauchen, kein erneuter Aufruf derselben
  // Seite (Vorschau-Roboter eines Mailprogramms eingeschlossen) — anders als
  // bei einer Einladung (invite/[token]/page.tsx) gibt es hier aber keinen
  // zweiten, expliziten Knopf: Eine Bestaetigungsmail wird genau angeklickt,
  // nicht vorher begutachtet, und "already" deckt den harmlosen Fall ab, in
  // dem derselbe Link zweimal aufgerufen wird.
  const outcome = await confirmNewsletter(token ?? '')
  const copy = OUTCOME_KEY[outcome] ?? OUTCOME_KEY.invalid

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-surface border border-black/10 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-950">{t(copy.title)}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t(copy.body)}</p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-zinc-950 underline"
        >
          {t('backHome')}
        </Link>
      </div>
    </div>
  )
}
