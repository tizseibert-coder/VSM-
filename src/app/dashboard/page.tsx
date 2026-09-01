import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut, createProject, createExampleProject, switchOrg } from './actions'
import { getActiveOrg } from '@/lib/org/activeOrg'
import DeleteProjectButton from '@/components/dashboard/DeleteProjectButton'
import VsmSketch from '@/components/marketing/VsmSketch'
import { buttonPrimary, buttonPrimaryLg, buttonSecondary } from '@/components/ui/buttons'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  const orgResult = await getActiveOrg()
  const activeOrg = 'error' in orgResult ? null : orgResult.active
  const allOrgs = 'error' in orgResult ? [] : orgResult.all

  // Die Abfrage hatte keinen Organisationsfilter — RLS liefert aber die
  // Projekte *aller* Organisationen des Nutzers. Mit nur einer Mitgliedschaft
  // fiel das nie auf; bei zweien waere die gemischte Liste unerklaerlich.
  const { data: projects } = activeOrg
    ? await supabase
        .from('projects')
        .select('id, name, description, created_at')
        .eq('organization_id', activeOrg.organizationId)
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              VSM Builder
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-zinc-950">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Angemeldet als {claims?.email}
              {activeOrg && (
                <>
                  {' '}
                  · {activeOrg.organizationName} ({activeOrg.role})
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/team"
              className={buttonSecondary}
            >
              Team
            </Link>
            <form action={signOut}>
              <button className={buttonSecondary}>
                Abmelden
              </button>
            </form>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Nur sichtbar, wenn es etwas zu wechseln gibt. Ein Umschalter mit
            genau einem Eintrag waere Ballast — und das ist bis auf Weiteres
            der Normalfall. Ein Formular je Organisation statt eines Selects:
            kein Client-JavaScript noetig, und bei zwei bis drei Firmen ist es
            auch schneller zu bedienen. */}
        {allOrgs.length > 1 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Organisation:</span>
            {allOrgs.map((org) => (
              <form key={org.organizationId} action={switchOrg.bind(null, org.organizationId)}>
                <button
                  type="submit"
                  aria-current={org.organizationId === activeOrg?.organizationId ? 'true' : undefined}
                  className={
                    org.organizationId === activeOrg?.organizationId
                      ? 'rounded-control bg-brand-600 px-3 py-1.5 text-xs font-medium text-white'
                      : 'rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100'
                  }
                >
                  {org.organizationName}
                </button>
              </form>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <form action={createProject} className="flex min-w-0 items-center gap-2">
            <input
              name="name"
              placeholder="Neues Projekt, z. B. Baugruppe X"
              required
              className="w-full rounded-control border border-zinc-300 px-3 py-2 text-sm sm:w-72"
            />
            <button
              type="submit"
              className={buttonPrimary}
            >
              Erstellen
            </button>
          </form>

          {/* Solange die Liste leer ist, traegt der Leerzustand darunter diese
              Handlung als Primaerknopf. Zweimal dasselbe Angebot auf einem
              ansonsten leeren Bildschirm laesst den Nutzer ueberlegen, ob die
              beiden Knoepfe Verschiedenes tun. */}
          {projects && projects.length > 0 && (
            <form action={createExampleProject}>
              <button
                type="submit"
                className={buttonSecondary}
              >
                Beispiel-VSM laden
              </button>
            </form>
          )}
        </div>

        <div className="mt-8">
          {!projects || projects.length === 0 ? (
            <div className="rounded-surface border border-zinc-200 bg-white p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                    Mit dem Beispiel-VSM anfangen
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    Eine Dreherei mit fünf Prozessen, Beständen und gerechneten Kennzahlen.
                    Ändere eine Zykluszeit und sieh zu, wie Durchlaufzeit und Taktzeit
                    reagieren.
                  </p>
                  <form action={createExampleProject} className="mt-5">
                    <button
                      type="submit"
                      className={buttonPrimaryLg}
                    >
                      Beispiel-VSM laden
                    </button>
                  </form>
                  <p className="mt-3 text-xs text-zinc-600">
                    Jederzeit löschbar. Oder leg oben ein eigenes Projekt an.
                  </p>
                </div>
                <div className="rounded-control border border-zinc-200 p-4">
                  <VsmSketch />
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-surface border border-zinc-200">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center gap-2 pr-5 hover:bg-zinc-100"
                >
                  {/* Der Link umschloss frueher die ganze Zeile. Ein Formular
                      darf nicht in einem <a> stehen, also sitzt der
                      Loeschen-Button als Geschwister daneben und der Link nimmt
                      nur noch den Rest der Breite ein. */}
                  <Link
                    href={`/editor/${project.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-950">
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="truncate text-xs text-zinc-500">
                          {project.description}
                        </div>
                      )}
                    </div>
                    <span className="ml-4 shrink-0 text-xs text-zinc-600">
                      Öffnen →
                    </span>
                  </Link>
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
