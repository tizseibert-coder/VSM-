import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '../actions'

// Fehlertexte in der Sprache des Empfaengers, nicht in der der Datenbank. Der
// Unterschied zwischen "zurueckgezogen" und "abgelaufen" ist fuer den
// Eingeladenen wichtig: im einen Fall soll er nachfragen, im anderen genuegt
// ein neuer Link.
// Nur die Zuordnung Status -> Uebersetzungsschluessel; die Saetze stehen im
// Namensraum `Invite`.
const STATUS_KEY: Record<string, string> = {
  expired: 'errExpired',
  revoked: 'errRevoked',
  already_used: 'errAccepted',
  invalid: 'errInvalid',
  not_authenticated: 'errSignIn',
  error: 'errGeneric',
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { token } = await params
  const t = await getTranslations('Invite')
  const { status } = await searchParams

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims?.sub)

  // Der Token wandert durch die Anmeldung hindurch, damit der Eingeladene nach
  // dem Registrieren wieder hier landet und nicht den Link erneut suchen muss.
  const returnTo = `/invite/${encodeURIComponent(token)}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-surface border border-black/10 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          VSM Builder
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">
          {t('title')}
        </h1>

        {status && STATUS_KEY[status] && (
          <p className="mt-4 rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(STATUS_KEY[status])}
          </p>
        )}

        {isSignedIn ? (
          <>
            <p className="mt-3 text-sm text-zinc-600">
              Du wurdest eingeladen, einem Team beizutreten. Nach dem Annehmen siehst du dessen
              Wertstromanalysen und kannst zwischen deinen Organisationen wechseln.
            </p>
            {/* Absichtlich ein Knopf und kein automatisches Einloesen beim
                Seitenaufruf: sonst wuerde schon die Linkvorschau eines
                Chat-Programms die Einladung verbrauchen. */}
            <form action={acceptInvite.bind(null, token)} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t('accept')}
              </button>
            </form>
            <p className="mt-4 text-center text-sm">
              <Link href="/dashboard" className="text-zinc-600 underline">
                {t('cancel')}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600">
              Melde dich an oder erstelle ein Konto, um die Einladung anzunehmen. Danach landest du
              automatisch wieder hier.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/login?next=${encodeURIComponent(returnTo)}`}
                className="rounded-control bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
              >
                {t('signIn')}
              </Link>
              <Link
                href={`/signup?next=${encodeURIComponent(returnTo)}`}
                className="rounded-control border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t('signUp')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
