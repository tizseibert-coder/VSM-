import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

// Erkennt das Sprachpraefix am Pfadanfang (z. B. "de" aus "/de/dashboard")
// und liefert den Rest des Pfads ohne Praefix — so pruefen die
// geschuetzten Routen unten weiterhin "/dashboard"/"/editor", unabhaengig
// davon, welche Sprache davorsteht.
function splitLocale(pathname: string): { locale: string | null; rest: string } {
  const match = pathname.match(/^\/([a-z]{2})(?=\/|$)/)
  const locale = match && (routing.locales as readonly string[]).includes(match[1]) ? match[1] : null
  return { locale, rest: locale ? pathname.slice(match![0].length) || '/' : pathname }
}

/**
 * baseResponse: die von next-intl bereits erzeugte Response (Pass-through
 * mit der erkannten Sprache am Request vermerkt). Wird hier weitergereicht
 * statt verworfen — nur wenn Supabase tatsaechlich Cookies schreiben muss
 * (Token-Refresh), entsteht eine neue Response, und die uebernimmt zuerst
 * alle Cookies, die next-intl schon gesetzt hat.
 */
export async function updateSession(request: NextRequest, baseResponse: NextResponse) {
  let supabaseResponse = baseResponse

  // With Fluid compute, never cache this client in a global variable.
  // Always create a new one per request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          baseResponse.cookies.getAll().forEach((cookie) => supabaseResponse.cookies.set(cookie))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getClaims().
  // A stray call here can make it very hard to debug users being
  // randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const isAuthed = !!data?.claims

  const { locale, rest: pathWithoutLocale } = splitLocale(request.nextUrl.pathname)
  const isProtectedRoute =
    pathWithoutLocale.startsWith('/dashboard') || pathWithoutLocale.startsWith('/editor')

  if (isProtectedRoute && !isAuthed) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale ?? routing.defaultLocale}/login`
    return NextResponse.redirect(url)
  }

  // IMPORTANT: always return supabaseResponse so refreshed auth cookies
  // reach the browser. Building a new NextResponse here would drop them.
  return supabaseResponse
}
