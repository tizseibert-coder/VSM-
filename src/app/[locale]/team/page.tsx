import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { revokeInvite } from './actions'
import InviteCreator from '@/components/team/InviteCreator'
import { buttonDangerSm } from '@/components/ui/buttons'

// Zuordnung Rolle/Status -> Uebersetzungsschluessel; die Texte stehen im
// Namensraum `Team`.
const ROLE_KEY: Record<string, string> = {
  owner: 'roleOwner',
  editor: 'roleEditor',
  viewer: 'roleViewer',
}

function inviteStatus(inv: {
  revoked_at: string | null
  accepted_at: string | null
  expires_at: string
}): { label: string; tone: string } {
  if (inv.accepted_at) return { label: 'Eingelöst', tone: 'text-zinc-500' }
  if (inv.revoked_at) return { label: 'Zurückgezogen', tone: 'text-zinc-500' }
  if (new Date(inv.expires_at) <= new Date())
    return { label: 'Abgelaufen', tone: 'text-amber-700' }
  return { label: 'Offen', tone: 'text-green-700' }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('Team')
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const myUserId = claimsData?.claims?.sub

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {orgResult.error}
          </p>
        </div>
      </div>
    )
  }

  const { active } = orgResult
  const isOwner = active.role === 'owner'

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, user_id, role')
    .eq('organization_id', active.organizationId)

  // Nur Inhaber sehen die Einladungsliste — die Policy laesst Mitglieder zwar
  // lesen, aber die Liste ist fuer sie ohne Nutzen, weil sie weder anlegen
  // noch zurueckziehen koennen.
  const { data: invitations } = isOwner
    ? await supabase
        .from('organization_invitations')
        .select('id, role, created_at, expires_at, revoked_at, accepted_at')
        .eq('organization_id', active.organizationId)
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t('yourRole', {
            org: active.organizationName,
            role: ROLE_KEY[active.role] ? t(ROLE_KEY[active.role]) : active.role,
          })}
        </p>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mt-8">
          <h2 className="text-base font-semibold text-zinc-950">
            Mitglieder ({members?.length ?? 0})
          </h2>
          {/* E-Mail-Adressen fehlen bewusst: auth.users ist ueber PostgREST
              nicht lesbar. Sie zu zeigen braucht eine gespiegelte
              profiles-Tabelle — bis dahin lieber nur die Rolle als ein
              erfundener Platzhaltername. */}
          <ul className="mt-3 divide-y divide-zinc-200 rounded-surface border border-zinc-200">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-zinc-800">
                  {m.user_id === myUserId ? 'Du' : `Mitglied ${m.user_id.slice(0, 8)}`}
                </span>
                <span className="text-xs text-zinc-500">
                  {ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {isOwner ? (
          <>
            <section className="mt-10">
              <h2 className="text-base font-semibold text-zinc-950">
                {t('inviteHeading')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {t('inviteBody', { org: active.organizationName })}
              </p>
              <div className="mt-4">
                <InviteCreator />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-base font-semibold text-zinc-950">
                Einladungen ({invitations?.length ?? 0})
              </h2>
              {!invitations || invitations.length === 0 ? (
                <p className="mt-3 rounded-surface border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                  {t('noInvites')}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-200 rounded-surface border border-zinc-200">
                  {invitations.map((inv) => {
                    const status = inviteStatus(inv)
                    const canRevoke = !inv.accepted_at && !inv.revoked_at
                    return (
                      <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-800">
                            {ROLE_KEY[inv.role] ? t(ROLE_KEY[inv.role]) : inv.role} ·{' '}
                            <span className={status.tone}>{status.label}</span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            Erstellt {new Date(inv.created_at).toLocaleDateString('de-CH')} · gültig
                            bis {new Date(inv.expires_at).toLocaleDateString('de-CH')}
                          </div>
                        </div>
                        {canRevoke && (
                          <form action={revokeInvite.bind(null, inv.id)} className="shrink-0">
                            <button
                              type="submit"
                              className={buttonDangerSm}
                            >
                              {t('revoke')}
                            </button>
                          </form>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        ) : (
          <p className="mt-10 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            {t('ownersOnly')}
          </p>
        )}
      </div>
    </div>
  )
}
