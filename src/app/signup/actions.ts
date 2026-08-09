'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = (formData.get('orgName') as string | null)?.trim()

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Bitte E-Mail und Passwort eingeben.'))
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

  redirect('/dashboard')
}
