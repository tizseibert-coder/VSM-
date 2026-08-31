import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { revokeInvite } from './actions'
import InviteCreator from '@/components/team/InviteCreator'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Inhaber',
  editor: 'Bearbeiten',
  viewer: 'Nur ansehen',
}

function inviteStatus(inv: {
  revoked_at: string | null
  accepted_at: string | null
  expires_at: string
}): { label: string; tone: string } {
  if (inv.accepted_at) return { label: 'Eingelöst', tone: 'text-zinc-500 dark:text-zinc-400' }
  if (inv.revoked_at) return { label: 'Zurückgezogen', tone: 'text-zinc-500 dark:text-zinc-400' }
  if (new Date(inv.expires_at) <= new Date())
    return { label: 'Abgelaufen', tone: 'text-amber-700 dark:text-amber-400' }
  return { label: 'Offen', tone: 'text-green-700 dark:text-green-400' }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const myUserId = claimsData?.claims?.sub

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            ← Dashboard
          </Link>
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
    <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Team</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {active.organizationName} · deine Rolle: {ROLE_LABEL[active.role] ?? active.role}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="mt-8">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Mitglieder ({members?.length ?? 0})
          </h2>
          {/* E-Mail-Adressen fehlen bewusst: auth.users ist ueber PostgREST
              nicht lesbar. Sie zu zeigen braucht eine gespiegelte
              profiles-Tabelle — bis dahin lieber nur die Rolle als ein
              erfundener Platzhaltername. */}
          <ul className="mt-3 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                  {m.user_id === myUserId ? 'Du' : `Mitglied ${m.user_id.slice(0, 8)}`}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {isOwner ? (
          <>
            <section className="mt-10">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Kollegen einladen
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Erzeuge einen Link und schick ihn selbst weiter — per Mail, Teams oder wie es dir
                passt. Wer ihn öffnet und sich anmeldet, wird Mitglied von{' '}
                {active.organizationName} und sieht alle VSMs dieser Firma.
              </p>
              <div className="mt-4">
                <InviteCreator />
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Einladungen ({invitations?.length ?? 0})
              </h2>
              {!invitations || invitations.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  Noch keine Einladung erstellt.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {invitations.map((inv) => {
                    const status = inviteStatus(inv)
                    const canRevoke = !inv.accepted_at && !inv.revoked_at
                    return (
                      <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-800 dark:text-zinc-200">
                            {ROLE_LABEL[inv.role] ?? inv.role} ·{' '}
                            <span className={status.tone}>{status.label}</span>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            Erstellt {new Date(inv.created_at).toLocaleDateString('de-CH')} · gültig
                            bis {new Date(inv.expires_at).toLocaleDateString('de-CH')}
                          </div>
                        </div>
                        {canRevoke && (
                          <form action={revokeInvite.bind(null, inv.id)} className="shrink-0">
                            <button
                              type="submit"
                              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-900 dark:hover:bg-red-950 dark:hover:text-red-400"
                            >
                              Zurückziehen
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
          <p className="mt-10 rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            Nur Inhaber können Mitglieder einladen oder entfernen.
          </p>
        )}
      </div>
    </div>
  )
}
