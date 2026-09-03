import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Sprachbewusste Ersatzstuecke fuer `next/link` und `next/navigation`.
 *
 * Wer stattdessen `next/link`/`useRouter` aus `next/navigation` direkt
 * benutzt, verliert die aktuelle Sprache beim Navigieren nicht sofort —
 * die Middleware faengt den fehlenden Praefix ab und leitet auf die per
 * Cookie/Accept-Language ermittelte Sprache um, nur eben mit einem
 * zusaetzlichen Sprung. `Link`/`redirect`/`useRouter` hier bleiben dagegen
 * ohne Umweg auf der aktuellen Sprache. Bestehende Stellen wandern in den
 * kommenden Phasen nach und nach hierher, wenn ihre Datei ohnehin fuer die
 * Uebersetzung angefasst wird — kein separater Umstellungsdurchgang noetig.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
