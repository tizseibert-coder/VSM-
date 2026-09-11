'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/nav/safeNextPath'
import { ATTRIBUTION_COOKIE, parseAttribution } from '@/lib/crm/attribution'
import { advanceStage, captureLead, recordLeadEvent } from '@/lib/crm/leads'
import { redirectLocalized } from '@/lib/nav/localeRedirect'

export async function signup(formData: FormData) {
  const locale = await getLocale()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = (formData.get('orgName') as string | null)?.trim()

  if (!email || !password) {
    redirectLocalized(
      '/signup?error=' + encodeURIComponent(await tErr('credentialsRequired')),
      locale
    )
  }
  if (password.length < 8) {
    redirectLocalized(
      '/signup?error=' + encodeURIComponent('Passwort muss mindestens 8 Zeichen haben.'),
      locale
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: orgName ? { data: { org_name: orgName } } : undefined,
  })

  if (error) {
    redirectLocalized('/signup?error=' + encodeURIComponent(error.message), locale)
  }

  // Der Uebergang vom Interessenten zum Nutzer. Wer ueber eine Anzeige kam,
  // hat hier seit dem ersten Besuch ein Attributionscookie; damit steht in der
  // Auswertung spaeter, welche Kampagne die Registrierung gebracht hat, und
  // nicht bloss, dass jemand kam.
  //
  // Bewusst *vor* den beiden Weichen unten: Ob eine Bestaetigungsmail noch
  // aussteht oder nicht, aendert nichts daran, dass die Registrierung
  // stattgefunden hat. Und bewusst ohne Fehlerbehandlung nach aussen — eine
  // Registrierung darf nicht daran scheitern, dass die Vertriebsschicht nicht
  // eingerichtet ist.
  await noteSignup(email, data.user?.id ?? null, orgName ?? null)

  // signUp() does NOT mean "logged in": when email confirmation is
  // required (the default), Supabase returns a user but no session.
  // Branch on the session explicitly instead of assuming success means
  // an active login — this is the exact gap found earlier in LeanPulse.
  if (!data.session) {
    redirectLocalized('/signup/check-email', locale)
  }

  // Zurueck zur Einladung, falls der Nutzer ueber einen Einladungslink kam.
  redirectLocalized(safeNextPath(formData.get('next') as string | null) ?? '/dashboard', locale)
}

/**
 * Legt den Interessenten an oder hebt ihn auf „in Erprobung".
 *
 * `advanceStage` statt eines festen `stage: 'trial'`: Wer als Kunde gefuehrt
 * wird und sich ein zweites Konto anlegt, faellt sonst auf eine niedrigere
 * Stufe zurueck.
 */
async function noteSignup(email: string, userId: string | null, orgName: string | null) {
  const store = await cookies()
  const attribution = parseAttribution(store.get(ATTRIBUTION_COOKIE)?.value)

  const result = await captureLead({
    email,
    company: orgName,
    locale: await getLocale(),
    source: 'signup',
    stage: 'trial',
    userId,
    attribution,
  })
  if (!result.ok) return

  await advanceStage(result.leadId, 'trial')
  await recordLeadEvent({
    leadId: result.leadId,
    kind: 'signup',
    payload: { orgName, userId },
  })
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
