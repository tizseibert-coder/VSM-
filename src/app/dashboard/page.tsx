import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut, createProject, createExampleProject } from './actions'
import DeleteProjectButton from '@/components/dashboard/DeleteProjectButton'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  let orgName: string | null = null
  let role: string | null = null

  if (claims?.sub) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', claims.sub)
      .maybeSingle()

    if (membership) {
      role = membership.role
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', membership.organization_id)
        .maybeSingle()
      orgName = org?.name ?? null
    }
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              VSM Builder
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Angemeldet als {claims?.email}
              {orgName && (
                <>
                  {' '}
                  · {orgName} ({role})
                </>
              )}
            </p>
          </div>
          <form action={signOut}>
            <button className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
              Abmelden
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <form action={createProject} className="flex min-w-0 items-center gap-2">
            <input
              name="name"
              placeholder="Neues Projekt, z. B. Baugruppe X"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:w-72 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Erstellen
            </button>
          </form>

          <form action={createExampleProject}>
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ✨ Beispiel-VSM laden
            </button>
          </form>
        </div>

        <div className="mt-8">
          {!projects || projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-500">
              Noch keine VSM-Projekte. Leg oben eins an, oder lade das Beispiel-VSM, um die
              Funktionen auszuprobieren.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center gap-2 pr-5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
                      <div className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {project.description}
                        </div>
                      )}
                    </div>
                    <span className="ml-4 shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
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
