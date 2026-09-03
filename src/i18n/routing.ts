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

// Zu `hreflang` steht hier bewusst nichts weiter: `alternateLinks` ist in
// next-intl standardmaessig an, und die Middleware setzt die Angaben pro
// Anfrage als HTTP-Header — nachgeprueft an /en/demo:
//
//   Link: <.../de/demo>; rel="alternate"; hreflang="de",
//         <.../en/demo>; rel="alternate"; hreflang="en",
//         <.../demo>;    rel="alternate"; hreflang="x-default"
//
// Das ist pfadgenau und schliesst x-default ein; Google wertet den
// Link-Header dafuer aus.
//
// Dieselben Angaben zusaetzlich als <link> im Root-Layout waeren nicht nur
// doppelt, sondern falsch: Das Layout kennt den Pfad der Seite nicht, jede
// Unterseite wuerde also "/de" und "/en" als ihre Entsprechungen angeben —
// /en/demo verwiese damit auf die deutsche *Startseite* statt auf /de/demo.
// Wer sie im HTML haben will, muss sie pro Seite in deren
// generateMetadata setzen, nicht zentral.

