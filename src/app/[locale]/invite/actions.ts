'use server'

import { getLocale } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirectLocalized } from '@/lib/nav/localeRedirect'

// Bewusst eine Action und kein Seitenaufruf: waere das Einloesen ein
// Nebeneffekt von GET, wuerde die Linkvorschau von Teams, Slack oder WhatsApp
// die Einladung verbrauchen, sobald jemand den Link nur *postet*. Der
// Empfaenger saehe dann "bereits eingeloest", ohne je geklickt zu haben.
export async function acceptInvite(token: string) {
  const locale = await getLocale()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) {
    console.error('acceptInvite failed:', error.message)
    redirectLocalized(`/invite/${encodeURIComponent(token)}?status=error`, locale)
  }

  // Bei Erfolg direkt ins Dashboard: dort greift der Organisationsumschalter,
  // und der Nutzer sieht sofort, dass er jetzt in zwei Firmen ist.
  if (data === 'accepted' || data === 'already_member') {
    revalidatePath('/dashboard')
    redirectLocalized('/dashboard', locale)
  }

  redirectLocalized(
    `/invite/${encodeURIComponent(token)}?status=${encodeURIComponent(String(data))}`,
    locale
  )
}
