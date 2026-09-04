import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut, createProject, createExampleProject, switchOrg } from './actions'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { loadPlan, loadPlanUsage } from '@/lib/billing/entitlement'
import { loadStaff } from '@/lib/crm/staff'
import DeleteProjectButton from '@/components/dashboard/DeleteProjectButton'
import VsmSketch from '@/components/marketing/VsmSketch'
import { buttonPrimary, buttonPrimaryLg, buttonSecondary } from '@/components/ui/buttons'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('Dashboard')
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

  // Tarif und Verbrauch. Die Anzeige laeuft unabhaengig davon, ob die Grenzen
  // schon greifen (VSM_PLAN_ENFORCEMENT) — wer sehen kann, wie voll sein
  // Kontingent ist, wird von der Grenze spaeter nicht ueberrascht.
  // Der Verwaltungsbereich ist von aussen nicht zu erraten und wird nur
  // verlinkt, wenn er auch offen ist — wer nicht in `vsm_staff` steht,
  // bekommt dort 404.
  const staff = await loadStaff()

  const plan = activeOrg ? await loadPlan(activeOrg.organizationId) : null
  const usage = activeOrg && plan ? await loadPlanUsage(activeOrg.organizationId, plan) : null

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              VSM Builder
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {t('signedInAs', { email: claims?.email ?? '' })}
              {activeOrg && (
                <>
                  {' '}
                  · {activeOrg.organizationName} ({activeOrg.role})
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {staff && (
              <Link href="/admin" className={buttonSecondary}>
                {t('admin')}
              </Link>
            )}
            <Link
              href="/team"
              className={buttonSecondary}
            >
              {t('team')}
            </Link>
            <form action={signOut}>
              <button className={buttonSecondary}>
                {t('signOut')}
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
            <span className="text-xs text-zinc-500">{t('organisation')}</span>
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

        {plan && usage && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-surface border border-zinc-200 bg-white px-5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded-control bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {t(`tier${plan.tier}`)}
              </span>
              <span className="text-sm text-zinc-600">
                {usage.projects.limit === null
                  ? t('planUsageUnlimited', { used: usage.projects.used })
                  : t('planUsage', {
                      used: usage.projects.used,
                      limit: usage.projects.limit,
                    })}
              </span>
            </div>
            <Link href="/pricing" className="text-sm font-medium text-brand-600 hover:underline">
              {usage.projects.allowed ? t('planCompare') : t('planUpgrade')}
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <form action={createProject} className="flex min-w-0 items-center gap-2">
            <input
              name="name"
              placeholder={t('newProjectPlaceholder')}
              required
              className="w-full rounded-control border border-zinc-300 px-3 py-2 text-sm sm:w-72"
            />
            <button
              type="submit"
              className={buttonPrimary}
            >
              {t('create')}
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
                {t('loadExample')}
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
                    {t('emptyTitle')}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {t('emptyBody')}
                  </p>
                  <form action={createExampleProject} className="mt-5">
                    <button
                      type="submit"
                      className={buttonPrimaryLg}
                    >
                      {t('loadExample')}
                    </button>
                  </form>
                  <p className="mt-3 text-xs text-zinc-600">
                    {t('emptyHint')}
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
                      {t('open')}
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
