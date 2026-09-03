import { type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/proxy'

const handleI18nRouting = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  // Sprache zuerst: fehlt das Praefix (z. B. /dashboard statt /de/dashboard),
  // leitet next-intl um, und die Supabase-Session-Aktualisierung braucht fuer
  // diesen Sprung gar nicht erst zu laufen — die naechste Anfrage traegt das
  // Praefix schon und durchlaeuft diese Funktion regulaer.
  const intlResponse = handleI18nRouting(request)
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  // Sonst reicht next-intl eine durchgereichte Response weiter (mit der
  // erkannten Sprache am Request vermerkt) — darauf setzt updateSession
  // seine eigenen Session-Cookies auf, statt sie zu verwerfen.
  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: [
    // Skip static assets and image optimization files; run on everything else.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
