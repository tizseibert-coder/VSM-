import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import DemoCanvas from '@/components/VSMEditor/DemoCanvas'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'
import { pageMetadata } from '@/lib/seo/site'

// Statt einer festen `metadata`-Konstante: Titel und Beschreibung haengen
// jetzt an der Sprache, muessen also pro Anfrage aufgeloest werden. Dazu die
// kanonische Adresse und die Sprachentsprechungen — ohne sie halten
// Suchmaschinen /de/demo und /en/demo fuer zwei Seiten mit demselben Inhalt.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Demo' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/demo',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

/**
 * Die Demo ohne Anmeldung.
 *
 * Der staerkste Verkaufshebel lag bisher hinter der Registrierung: Ein Black
 * Belt gibt seine Firmenadresse nicht heraus, um herauszufinden, ob ein
 * Werkzeug seine Symbolik beherrscht. Hier ist alles bedienbar, nichts wird
 * gespeichert, und es gibt keinen Datenbankzugriff — also auch nichts, was
 * jemand missbrauchen koennte.
 */
export default async function DemoPage() {
  const t = await getTranslations('Demo')
  const tNav = await getTranslations('Nav')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-widest text-brand-600 hover:underline"
            >
              VSM Builder
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
              {t('heading')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/login" className={buttonSecondary}>
              {tNav('login')}
            </Link>
            <Link href="/signup" className={buttonPrimary}>
              {tNav('signup')}
            </Link>
          </div>
        </div>
      </header>

      {/* Der Hinweis steht oben und nicht als Fusszeile: Wer gleich Zahlen
          aendert, soll vorher wissen, dass sie nicht bleiben. */}
      <div className="border-b border-zinc-200 bg-brand-50">
        <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-zinc-700">
          <span className="font-medium text-zinc-950">{t('noticeStrong')}</span>{' '}
          {t('noticeBody')}
        </p>
      </div>

      <DemoCanvas />
    </div>
  )
}
