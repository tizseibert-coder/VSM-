import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { PUBLIC_PATHS, localizedUrl } from '@/lib/seo/site'

/**
 * Die Sitemap — eine Zeile je Seite und Sprache, jede mit den Verweisen auf
 * ihre Entsprechungen.
 *
 * `alternates.languages` ist der Teil, der zaehlt: Ohne ihn haelt Google
 * `/de/pricing` und `/en/pricing` fuer zwei Seiten mit demselben Inhalt und
 * waehlt eine davon aus — regelmaessig die falsche. Mit den Angaben weiss es,
 * dass es dieselbe Seite in zwei Sprachen ist, und zeigt jedem Land seine.
 *
 * `lastModified` steht bewusst auf dem Zeitpunkt des Baus und nicht auf einem
 * festen Datum: Es ist der ehrlichste Wert, den diese Datei kennt — die
 * Inhalte kommen aus den Uebersetzungsdateien und dem Quelltext, aendern sich
 * also genau mit dem Bau. Ein gepflegtes Datum je Seite waere genauer und
 * waere binnen dreier Aenderungen falsch.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((entry) => ({
      url: localizedUrl(locale, entry.path),
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(
            routing.locales.map((code) => [code, localizedUrl(code, entry.path)])
          ),
          // Fuer Besucher, deren Sprache keine der angebotenen ist. Ohne
          // diesen Eintrag waehlt Google selbst, und das ist bei einem
          // deutschen Fachwerkzeug regelmaessig die englische Fassung.
          'x-default': localizedUrl(routing.defaultLocale, entry.path),
        },
      },
    }))
  )
}
