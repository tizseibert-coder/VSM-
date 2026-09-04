import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/proxy'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  readAttributionFromUrl,
  serializeAttribution,
} from '@/lib/crm/attribution'

const handleI18nRouting = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  // Sprache zuerst: fehlt das Praefix (z. B. /dashboard statt /de/dashboard),
  // leitet next-intl um, und die Supabase-Session-Aktualisierung braucht fuer
  // diesen Sprung gar nicht erst zu laufen — die naechste Anfrage traegt das
  // Praefix schon und durchlaeuft diese Funktion regulaer.
  const intlResponse = handleI18nRouting(request)
  if (intlResponse.headers.get('location')) {
    // Die Herkunft wird trotzdem vermerkt, und zwar *hier*: Ein Klick aus
    // einer LinkedIn-Anzeige landet auf `/?utm_source=…` ohne Sprachpraefix.
    // Die Umleitung auf `/de` verliert die Parameter nicht (next-intl haengt
    // die Suchanfrage an), aber die *Verweisquelle* geht verloren — der
    // Browser schickt beim Folgen der Umleitung keinen neuen Referer.
    return rememberAttribution(request, intlResponse)
  }

  // Sonst reicht next-intl eine durchgereichte Response weiter (mit der
  // erkannten Sprache am Request vermerkt) — darauf setzt updateSession
  // seine eigenen Session-Cookies auf, statt sie zu verwerfen.
  const response = await updateSession(request, intlResponse)
  return rememberAttribution(request, response)
}

/**
 * Schreibt einmal je Besucher, woher er kam.
 *
 * Erster Schreiber gewinnt (`request.cookies.has`): Wer ueber eine
 * LinkedIn-Anzeige kommt, sich umsieht und erst beim dritten Besuch ueber
 * die Google-Suche registriert, ist ein Treffer der Anzeige. Ein Cookie, das
 * jeder Besuch ueberschreibt, schriebe der Suchmaschine gut, was die Anzeige
 * gebracht hat.
 *
 * Erstanbieter, kein Dienst von aussen, keine Kennung ueber Webseiten hinweg:
 * Es steht ausschliesslich drin, was in der aufgerufenen Adresse stand.
 */
function rememberAttribution(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.has(ATTRIBUTION_COOKIE)) return response

  const attribution = readAttributionFromUrl(
    request.nextUrl,
    request.headers.get('referer')
  )
  if (!attribution) return response

  response.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(attribution), {
    // Gelesen wird es ausschliesslich serverseitig (von der Registrierung und
    // vom Interessentenformular) — im Browser hat es nichts zu suchen.
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
  })

  return response
}

export const config = {
  matcher: [
    // Skip static assets and image optimization files; run on everything else.
    //
    // `robots.txt` und `sitemap.xml` stehen seit dem SEO-Ausbau mit in dieser
    // Ausnahmeliste, und das ist keine Kosmetik: Ohne sie greift die
    // Sprachweiche von next-intl auch auf sie zu und antwortet mit einer
    // Umleitung auf `/de/robots.txt` — eine Adresse, die es nicht gibt. Ein
    // Suchmaschinen-Roboter fragt beides ausschliesslich an der Wurzel ab und
    // haette damit weder die Sitemap noch die Ausschlussregeln gefunden.
    // Nachgeprueft mit `curl` gegen `next start`: vorher `/de/sitemap.xml`,
    // jetzt das XML.
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
