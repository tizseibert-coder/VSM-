import { defineRouting } from 'next-intl/routing'

/**
 * Die unterstützten Sprachen und ihr Standardverhalten in der URL.
 *
 * `localePrefix: 'always'` heisst: auch Deutsch (die Standardsprache) steht
 * sichtbar in der URL (`/de/...`), nicht nur Englisch (`/en/...`). Bewusst
 * so — ein nacktes `/` waere sonst mehrdeutig ("keine Sprache gewaehlt" vs.
 * "Deutsch, weil Standard"), und jeder Link bleibt dadurch fuer sich allein
 * eindeutig teilbar und von Suchmaschinen getrennt indexierbar, was fuer die
 * Verkaufsseite zaehlt.
 *
 * `localeDetection` bleibt auf dem Standardwert `true`: next-intl liest beim
 * ersten Besuch den `Accept-Language`-Header des Browsers (das ist die
 * tatsaechliche Entsprechung zu "erkennt automatisch, welche Sprache
 * jemand spricht" bei einer Website — es gibt keinen Fliesstext, aus dem
 * man das ableiten koennte, wie bei einem Chat). Ab dem ersten Besuch
 * entscheidet danach das gesetzte Cookie, nicht laufend erneut der Header.
 */
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'always',
})
