import type { Locale } from 'next-intl'
import { redirect as navRedirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Eine Umleitung, die das Sprachpraefix mitnimmt.
 *
 * Warum es diesen Umweg braucht — zwei Gruende, beide gemessen:
 *
 * 1. `redirect` aus `next/navigation` schreibt den Pfad so, wie er dasteht:
 *    "/dashboard", nicht "/de/dashboard". Bei einem Seitenaufruf faengt der
 *    Proxy das ab. Bei einer Server Action nicht — deren `redirect()` ist
 *    laut Next-Dokumentation ein Sprung im Browser-Router ("performs a
 *    client-side navigation when JavaScript is available"), kein
 *    Dokumentenaufruf. Die Adresszeile behaelt den Pfad ohne Praefix.
 *
 * 2. Warum nicht `redirect` aus @/i18n/navigation direkt? Weil TypeScript
 *    seine `never`-Rueckgabe dort nicht als Abbruch erkennt: Die Verengung
 *    nach einer nie zurueckkehrenden Funktion greift nur bei einer
 *    Deklaration mit *ausdruecklicher* Typangabe, und next-intl liefert
 *    `redirect` als Feld eines hergeleiteten Objekts aus createNavigation().
 *    Ohne die Verengung wuerde
 *
 *        if (!claims?.sub) redirect(...)
 *        const email = claims.claims.email   // "possibly undefined"
 *
 *    nicht mehr uebersetzen — nachgeprueft, genau diese Meldung. Diese
 *    Funktion traegt die Angabe `: never` deshalb selbst.
 *
 * Die Sprache kommt vom Aufrufer (`await getLocale()`), nicht von hier: In
 * einer Server Action gibt es kein [locale]-Segment, und ein Vorgabewert
 * waere die stille Falle — englische Nutzer landeten auf deutschen Seiten.
 */
export function redirectLocalized(href: string, locale: Locale): never {
  // GEGENPROBE, wird unmittelbar zurueckgenommen: Die uebergebene Sprache
  // wird verworfen und immer die Standardsprache genommen — genau der stille
  // Rueckfall, den der englische Test fangen soll. Faellt er nicht, prueft er
  // nichts und dieser ganze Umbau haette eine Luecke.
  void locale
  return navRedirect({ href, locale: routing.defaultLocale })
}
