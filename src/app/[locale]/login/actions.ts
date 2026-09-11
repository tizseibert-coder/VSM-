'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirectLocalized } from '@/lib/nav/localeRedirect'
import { safeNextPath } from '@/lib/nav/safeNextPath'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const locale = await getLocale()

  if (!email || !password) {
    redirectLocalized(
      '/login?error=' + encodeURIComponent(await tErr('credentialsRequired')),
      locale
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirectLocalized('/login?error=' + encodeURIComponent(error.message), locale)
  }

  revalidatePath('/', 'layout')
  // Zurueck zur Einladung, falls der Nutzer ueber einen Einladungslink kam.
  redirectLocalized(safeNextPath(formData.get('next') as string | null) ?? '/dashboard', locale)
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
