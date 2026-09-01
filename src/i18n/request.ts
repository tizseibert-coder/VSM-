import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

/**
 * Liefert pro Anfrage die aktive Sprache plus die dazu passenden Texte.
 *
 * `requestLocale` ist das von der Middleware ermittelte `[locale]`-Segment.
 * Ungueltige Werte fallen auf `defaultLocale` zurueck — das faengt vor
 * allem den Fall ab, dass eine Route ausserhalb von `[locale]` rendert
 * (z. B. `app/opengraph-image.tsx`, das bewusst ausserhalb bleibt, siehe
 * dessen eigene Kommentare) und deshalb kein Segment mitbringt.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
