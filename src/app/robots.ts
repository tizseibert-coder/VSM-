import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site'

/**
 * Was Suchmaschinen nicht anfassen sollen.
 *
 * Die vier gesperrten Zweige sind nicht geheim (dafuer gibt es RLS und die
 * Anmeldung), sie sind nur wertlos im Index: `/admin` und `/dashboard`
 * antworten einem Roboter mit einer Weiterleitung zur Anmeldung, `/editor`
 * ebenso, und `/invite` traegt einen Einmal-Token in der Adresse — der
 * gehoert in keinen Index und in kein Protokoll eines Crawlers.
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
  const closed = ['/admin', '/dashboard', '/editor', '/invite', '/auth']

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
