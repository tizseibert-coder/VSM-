import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadInviteBranding } from '@/lib/org/inviteBranding'
import { DEFAULT_BRAND_COLOR, readableTextOn } from '@/lib/org/branding'
import OrgMark from '@/components/org/OrgMark'
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

  // Wer einlaedt, und was er dem Empfaenger sagen wollte. Null heisst: keine
  // eigenen Angaben hinterlegt — dann steht hier dieselbe Seite wie bisher.
  // Ob die Einladung *gilt*, entscheidet weiterhin ausschliesslich das
  // Einloesen; hier wird nichts geprueft, nur angezeigt.
  const branding = await loadInviteBranding(token)
  const brandColor = branding?.brandColor ?? DEFAULT_BRAND_COLOR
  const onBrand = readableTextOn(brandColor)
  const invitingOrg = branding?.organizationName?.trim() || null

  // Der Token wandert durch die Anmeldung hindurch, damit der Eingeladene nach
  // dem Registrieren wieder hier landet und nicht den Link erneut suchen muss.
  const returnTo = `/invite/${encodeURIComponent(token)}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-surface border border-black/10 bg-white">
        {/* Der Balken traegt die Farbe des Einladenden, nicht unsere. Fuer den
            Empfaenger ist das die erste Seite dieser Anwendung ueberhaupt —
            sie soll aussehen wie eine Einladung seines Gegenuebers und nicht
            wie der Systemhinweis eines Werkzeugs, das er nicht kennt. */}
        <div
          className="flex items-center gap-3 px-8 py-5"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          {invitingOrg && <OrgMark logoUrl={branding?.logoDataUrl ?? null} name={invitingOrg} />}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
              VSM Builder
            </p>
            {invitingOrg && (
              <p className="truncate text-base font-semibold leading-tight">{invitingOrg}</p>
            )}
          </div>
        </div>

        <div className="p-8">
          <h1 className="text-2xl font-semibold text-zinc-950">
            {branding?.inviteeName
              ? t('titleNamed', { name: branding.inviteeName })
              : t('title')}
          </h1>

          {status && STATUS_KEY[status] && (
            <p className="mt-4 rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t(STATUS_KEY[status])}
            </p>
          )}

          {/* Die Anrede des Absenders steht ueber unserem Text, nicht darunter:
              Sie ist die Nachricht, unserer ist die Erklaerung dazu.
              `whitespace-pre-line`, weil jemand, der drei Zeilen schreibt,
              drei Zeilen meint. */}
          {branding?.welcomeMessage && (
            <blockquote className="mt-4 whitespace-pre-line border-l-2 border-zinc-200 pl-4 text-sm leading-relaxed text-zinc-700">
              {branding.welcomeMessage}
            </blockquote>
          )}

          {isSignedIn ? (
            <>
              <p className="mt-4 text-sm text-zinc-600">
                {invitingOrg ? t('bodyNamed', { org: invitingOrg }) : t('body')}
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
              <p className="mt-4 text-sm text-zinc-600">{t('signedOutBody')}</p>
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
    </div>
  )
}
