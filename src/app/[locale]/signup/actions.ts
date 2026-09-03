'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/nav/safeNextPath'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = (formData.get('orgName') as string | null)?.trim()

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent(await tErr('credentialsRequired')))
  }
  if (password.length < 8) {
    redirect('/signup?error=' + encodeURIComponent('Passwort muss mindestens 8 Zeichen haben.'))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: orgName ? { data: { org_name: orgName } } : undefined,
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  // signUp() does NOT mean "logged in": when email confirmation is
  // required (the default), Supabase returns a user but no session.
  // Branch on the session explicitly instead of assuming success means
  // an active login — this is the exact gap found earlier in LeanPulse.
  if (!data.session) {
    redirect('/signup/check-email')
  }

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
