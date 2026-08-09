'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function signInWithOAuthProvider(provider: 'google' | 'apple') {
  const supabase = await createClient()
  const originHeader = (await headers()).get('origin')
  const origin = originHeader ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=' + encodeURIComponent(error?.message ?? 'OAuth-Login fehlgeschlagen.'))
  }

  redirect(data.url)
}

export async function signInWithGoogle() {
  await signInWithOAuthProvider('google')
}

export async function signInWithApple() {
  await signInWithOAuthProvider('apple')
}
