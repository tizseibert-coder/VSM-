// Die eigene Adresse und was Suchmaschinen daraus machen sollen.
//
// Bis hierher stand `NEXT_PUBLIC_SITE_URL` an drei Stellen im Code (Layout,
// OAuth-Rueckkehr, Einladungslinks), jede mit ihrem eigenen Rueckfall. Fuer
// die Suchmaschinen kommt jetzt eine vierte Art von Nutzung dazu — kanonische
// Adressen und Sprachalternativen —, und die vertraegt keine Abweichung: Zwei
// Schreibweisen derselben Seite (mit und ohne Schraegstrich, mit und ohne
// www) sind fuer Google zwei Seiten, die sich gegenseitig verdraengen.

import { routing } from '@/i18n/routing'

/**
 * Die oeffentliche Adresse ohne abschliessenden Schraegstrich.
 *
 * Der lokale Rueckfall ist kein Versehen: Ohne ihn faellt jeder Bau ohne
 * gesetzte Variable um, und `next build` laeuft auch auf Rechnern, auf denen
 * die Produktionsadresse nichts zu suchen hat.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

/** Absolute Adresse eines Pfads in einer Sprache. */
export function localizedUrl(locale: string, path: string): string {
  const clean = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/g, '')}`
  return `${siteUrl()}/${locale}${clean}`
}

/**
 * Die `alternates`-Angabe einer Seite: kanonische Adresse plus jede Sprache.
 *
 * `x-default` zeigt auf die Standardsprache. Google nimmt den Wert fuer
 * Besucher, deren Sprache keine der angebotenen ist — ohne ihn waehlt es
 * selbst, und das ist bei einem deutschen Fachwerkzeug regelmaessig die
 * englische Fassung.
 *
 * next-intl setzt dieselben Angaben schon als `Link`-HTTP-Header (siehe
 * i18n/routing.ts). Doppelt ist hier nicht falsch, sondern belastbarer: Den
 * Header werten nicht alle Werkzeuge aus — der Vorschau-Roboter von LinkedIn
 * zum Beispiel liest nur das HTML.
 */
export function alternatesFor(locale: string, path: string) {
  const languages = Object.fromEntries(
    routing.locales.map((code) => [code, localizedUrl(code, path)])
  )

  return {
    canonical: localizedUrl(locale, path),
    languages: {
      ...languages,
      'x-default': localizedUrl(routing.defaultLocale, path),
    },
  }
}

/**
 * Was eine oeffentliche Seite an Metadaten braucht — an einer Stelle, damit
 * keine Seite die Haelfte davon vergisst.
 *
 * `openGraph.url` ist der Punkt, an dem es sonst still schiefgeht: Ohne ihn
 * nimmt LinkedIn die Adresse, ueber die der Roboter kam. Wer den Link mit
 * `?utm_source=…` teilt, bekommt die Kampagnenparameter in die Vorschau —
 * und im Beitrag steht eine Adresse, die niemand kopieren soll.
 */
export function pageMetadata(options: {
  locale: string
  path: string
  title: string
  description: string
  ogLocale: string
  /** Fuer Seiten, die es geben soll, aber nicht im Index. */
  noindex?: boolean
}) {
  const url = localizedUrl(options.locale, options.path)

  return {
    title: options.title,
    description: options.description,
    alternates: alternatesFor(options.locale, options.path),
    openGraph: {
      type: 'website' as const,
      url,
      locale: options.ogLocale,
      siteName: 'VSM Builder',
      title: options.title,
      description: options.description,
    },
    twitter: { card: 'summary_large_image' as const },
    ...(options.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * Die oeffentlichen Seiten — die Liste, aus der `sitemap.ts` und die
 * Fusszeile leben.
 *
 * Alles, was hinter der Anmeldung liegt, fehlt hier mit Absicht: Ein
 * Dashboard in der Sitemap ist eine Einladung an den Roboter, gegen eine
 * Anmeldeseite zu laufen, und verduennt die Bewertung der Seiten, auf die es
 * ankommt.
 */
export const PUBLIC_PATHS = [
  { path: '/', priority: 1, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/demo', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/data-sheet', priority: 0.5, changeFrequency: 'yearly' as const },
  { path: '/signup', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/login', priority: 0.2, changeFrequency: 'yearly' as const },
] as const
