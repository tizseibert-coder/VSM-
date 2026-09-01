import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'

/**
 * Zielseite fuer Fehler, die eine Server-Action nicht am Ort melden kann.
 *
 * Vorher stand hier ein Satz ohne Ausweg ("Etwas ist schiefgelaufen"). Das
 * ist die schlechteste Stelle fuer eine Sackgasse: Wer sie sieht, hat gerade
 * etwas verloren und muss selbst herausfinden, wohin jetzt. Ein Weg zurueck
 * und die Einordnung, dass die Daten nicht betroffen sind, kosten nichts und
 * nehmen die Sorge, die man an dieser Stelle tatsaechlich hat.
 */
export default async function ErrorPage() {
  const t = await getTranslations('ErrorPage')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-surface border border-zinc-200 bg-white p-8">
        {/* Der Produktname bleibt unuebersetzt — eine Wortmarke wird nicht
            lokalisiert. */}
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          VSM Builder
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
          {t('title')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{t('body')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className={buttonPrimary}>
            {t('backToDashboard')}
          </Link>
          <Link href="/login" className={buttonSecondary}>
            {t('loginAgain')}
          </Link>
        </div>
        <p className="mt-5 text-xs text-zinc-600">{t('hint')}</p>
      </div>
    </div>
  )
}
