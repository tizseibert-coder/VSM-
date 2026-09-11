'use server'

import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect as externalRedirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { redirectLocalized } from '@/lib/nav/localeRedirect'

async function signInWithOAuthProvider(provider: 'google' | 'apple') {
  const locale = await getLocale()
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
    redirectLocalized(
      '/login?error=' + encodeURIComponent(error?.message ?? 'OAuth-Login fehlgeschlagen.'),
      locale
    )
  }

  // Hier bewusst die nackte Umleitung: `data.url` zeigt zu Googles bzw. Apples
  // Anmeldeseite. next-intl liesse eine fremde Adresse zwar unberuehrt
  // (isLocalizableHref ist dafuer falsch), aber sie durch eine *sprachbewusste*
  // Umleitung zu schicken laese sich wie ein Versehen.
  externalRedirect(data.url)
}

export async function signInWithGoogle() {
  await signInWithOAuthProvider('google')
}

export async function signInWithApple() {
  await signInWithOAuthProvider('apple')
}
