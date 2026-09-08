import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import DemoCanvas from '@/components/VSMEditor/DemoCanvas'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'
import { pageMetadata, SITE_NAME } from '@/lib/seo/site'

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
 * Werkzeug seine Symbolik beherrscht. Hier ist alles bedienbar, und es gibt
 * keinen Datenbankzugriff — also auch nichts, was jemand missbrauchen
 * koennte.
 */
export default async function DemoPage() {
  const t = await getTranslations('Demo')
  const tNav = await getTranslations('Nav')
  const tHome = await getTranslations('Home')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-widest text-brand-600 hover:underline"
            >
              {SITE_NAME}
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

      {/* Hinweisbalken und Abschluss haengen beide an DemoCanvas: Der eine
          muss sagen, ob schon etwas im Browser liegt, der andere nennt die
          Zahlen des Lesers — beide brauchen dessen Zustand. */}
      <DemoCanvas />

      {/* [Marketing-Audit 2026-09-07, A1] Die Seite endete bisher mit der
          Zeichenflaeche: kein Verweis, der weiterfuehrt, und damit eine
          Sackgasse — fuer den Leser wie fuer eine Suchmaschine, die von hier
          aus keine der oeffentlichen Unterseiten mehr erreicht. */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-8 text-sm text-zinc-600">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href="/"
              className="font-semibold uppercase tracking-widest text-brand-600 hover:underline"
            >
              {SITE_NAME}
            </Link>
            <span>{tHome('footerTagline')}</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/pricing" className="hover:text-brand-600 hover:underline">
              {tNav('pricing')}
            </Link>
            <Link href="/data-sheet" className="hover:text-brand-600 hover:underline">
              {tNav('dataSheet')}
            </Link>
            <Link href="/login" className="hover:text-brand-600 hover:underline">
              {tNav('login')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
