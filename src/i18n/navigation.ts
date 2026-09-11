import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Sprachbewusste Ersatzstuecke fuer `next/link` und `next/navigation`.
 *
 * `Link` von hier bleibt beim Navigieren ohne Umweg auf der aktuellen Sprache;
 * `next/link` verliert das Praefix, und die Middleware holt es mit einem
 * zusaetzlichen Sprung nach.
 *
 * Fuer Umleitungen gilt das so *nicht*, und das war lange als Fussnote im
 * Kommentar hier versteckt: In einer Server Action ist `redirect()` laut
 * Next-Dokumentation ein Sprung im Browser-Router ("performs a client-side
 * navigation when JavaScript is available"), kein Dokumentenaufruf. Die
 * Middleware sieht ihn also gar nicht, und die Adresszeile bleibt ohne
 * Praefix stehen — in den Browsertests gemessen, ueber sechzig Abfragen
 * hinweg. Alle Actions gehen deshalb ueber `redirectLocalized` aus
 * `@/lib/nav/localeRedirect`; warum nicht ueber das `redirect` hier direkt,
 * steht dort.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
