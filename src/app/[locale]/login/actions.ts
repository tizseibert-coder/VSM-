'use server'

import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/nav/safeNextPath'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent(await tErr('credentialsRequired')))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  // Zurueck zur Einladung, falls der Nutzer ueber einen Einladungslink kam.
  redirect(safeNextPath(formData.get('next') as string | null) ?? '/dashboard')
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
