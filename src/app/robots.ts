import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site'

/**
 * Was Suchmaschinen nicht anfassen sollen.
 *
 * Die gesperrten Zweige sind nicht geheim (dafuer gibt es RLS und die
 * Anmeldung), sie sind nur wertlos im Index: `/admin`, `/dashboard`,
 * `/settings` und `/team` antworten einem Roboter mit einer Weiterleitung
 * zur Anmeldung (oder, bei `/team`, mit einer leeren Fehlerkarte — siehe
 * dessen eigene `generateMetadata` fuer den Grund), `/editor` ebenso, und
 * `/invite` traegt einen Einmal-Token in der Adresse — der gehoert in
 * keinen Index und in kein Protokoll eines Crawlers.
 *
 * [SEO-Audit 2026-09-09, S1/S2] `/settings` und `/team` fehlten hier: Die
 * Middleware schuetzt `/settings` genauso wie `/dashboard` (siehe
 * lib/supabase/proxy.ts), und `/team` antwortet einem Nichtangemeldeten
 * sogar mit 200 statt einer Weiterleitung — beides ohne Eintrag hier reine
 * Verschwendung von Crawl-Budget, bei `/team` zusaetzlich eine crawlbare
 * Seite ohne eigenen Inhalt.
 *
 * Bewusst *kein* pauschales `Disallow` fuer den Rest: Die Verkaufsseite, die
 * Demo und der Erhebungsbogen sind der Grund, warum es diese Datei gibt.
 *
 * Die Sprachpraefixe (`/de`, `/en`) stehen mit drin: robots.txt kennt keine
 * regulaeren Ausdruecke ausser `*` und `$`, und `/*\/admin/` waere zwar
 * kuerzer, wird aber nicht von jedem Roboter gleich ausgelegt.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  const closed = ['/admin', '/dashboard', '/editor', '/settings', '/team', '/invite', '/auth']

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: closed.flatMap((path) => [
        `${path}/`,
        `/de${path}/`,
        `/en${path}/`,
      ]),
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
