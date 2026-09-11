import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { SITE_NAME } from '@/lib/seo/site'
import { createClient } from '@/lib/supabase/server'
import { signOut, createExampleProject, switchOrg } from './actions'
import { openBillingPortal } from '@/app/[locale]/pricing/actions'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { loadPlan, loadPlanUsage } from '@/lib/billing/entitlement'
import { isPurchasableTier } from '@/lib/billing/stripe'
import { loadStaff } from '@/lib/crm/staff'
import DeleteProjectButton from '@/components/dashboard/DeleteProjectButton'
import DemoImportBanner from '@/components/dashboard/DemoImportBanner'
import FirstValueStreamProgress from '@/components/dashboard/FirstValueStreamProgress'
import OrgMark from '@/components/org/OrgMark'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { orgLogoUrl } from '@/lib/org/branding'
import VsmSketch from '@/components/marketing/VsmSketch'
import { buttonPrimary, buttonPrimaryLg, buttonSecondary } from '@/components/ui/buttons'
import { SubmitButton } from '@/components/ui/SubmitButton'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('Dashboard')
  const tNav = await getTranslations('Nav')
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

  // Das Firmenprofil. Ohne Zeile ergibt es den Namen aus dem gemeinsamen Login
  // und kein Bild — derselbe Kopf wie bisher, nur mit dem Platz, an dem das
  // Logo stehen wird.
  const profile = activeOrg
    ? await loadOrgProfile(activeOrg.organizationId, activeOrg.organizationName)
    : null
  const logoUrl =
    profile?.hasLogo ? orgLogoUrl(profile.organizationId, profile.logoVersion) : null

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Am Telefon uebereinander, ab sm nebeneinander. Die Knopfreihe stand
            auf `shrink-0` und weigerte sich damit zu schrumpfen: Bei vier
            Knoepfen (Verwaltung, Firma, Team, Abmelden) lief sie rechts aus dem
            Bild und drueckte die Identitaetsspalte auf fast null Breite — die
            Anschrift brach dann auf ein Wort je Zeile um, und der Titel lag
            unter den Knoepfen. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {activeOrg && profile && (
              <OrgMark logoUrl={logoUrl} name={profile.displayName} />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                {SITE_NAME}
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
              {/* Eine Anschrift ist ein Wort ohne Trennstellen: Ohne
                  `break-words` schiebt eine lange Adresse die Spalte breiter,
                  als der Bildschirm ist, statt umzubrechen. */}
              <p className="mt-1 break-words text-sm text-zinc-600">
                {t('signedInAs', { email: claims?.email ?? '' })}
                {activeOrg && (
                  <>
                    {' '}
                    · {profile?.displayName ?? activeOrg.organizationName} ({activeOrg.role})
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {staff && (
              <Link href="/admin" className={buttonSecondary}>
                {t('admin')}
              </Link>
            )}
            <Link href="/settings" className={buttonSecondary}>
              {t('settings')}
            </Link>
            <Link
              href="/team"
              className={buttonSecondary}
            >
              {t('team')}
            </Link>
            <form action={signOut}>
              <SubmitButton className={buttonSecondary}>{t('signOut')}</SubmitButton>
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
                <SubmitButton
                  aria-current={org.organizationId === activeOrg?.organizationId ? 'true' : undefined}
                  className={
                    org.organizationId === activeOrg?.organizationId
                      ? 'rounded-control bg-brand-600 px-3 py-1.5 text-xs font-medium text-white'
                      : 'rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100'
                  }
                >
                  {org.organizationName}
                </SubmitButton>
              </form>
            ))}
          </div>
        )}

        {/* [Marketing-Audit 2026-09-07, A2] Ueber dem Tarifstreifen und ueber
            der Projektliste: Wer gerade aus der Demo kommt, soll das als
            Erstes sehen. Zeichnet nichts, wenn im Browser nichts liegt. */}
        <DemoImportBanner />

        {/* [Marketing-Audit 2026-09-07, B3] Nur bei genau einem Projekt: das
            ist der Moment kurz nach der Anmeldung, den der Fund beschreibt.
            Zeichnet nichts, sobald ein Szenario steht oder ein zweites
            Projekt existiert. */}
        {projects && projects.length === 1 && (
          <FirstValueStreamProgress projectId={projects[0].id} />
        )}

        {plan && usage && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-surface border border-zinc-200 bg-white px-5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded-control bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {t(`tier${plan.tier}`)}
              </span>
              <span className="text-sm text-zinc-600">
                {/* Drei Faelle, nicht zwei. „2 von 1 Wertstroemen" ist
                    rechnerisch richtig und liest sich wie ein Tippfehler:
                    „X von Y" verspricht, dass X hineinpasst. Ueber der Grenze
                    zu liegen ist erlaubt (Durchsetzung aus, Grenze
                    nachtraeglich gesenkt, Tarif ausgelaufen) und braucht
                    deshalb einen eigenen Satz statt einer Zahl, die man
                    zweimal liest. */}
                {usage.projects.limit === null
                  ? t('planUsageUnlimited', { used: usage.projects.used })
                  : usage.projects.used > usage.projects.limit
                    ? t('planUsageOver', {
                        used: usage.projects.used,
                        limit: usage.projects.limit,
                      })
                    : t('planUsage', {
                        used: usage.projects.used,
                        limit: usage.projects.limit,
                      })}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* [Marketing-Audit 2026-09-07, B5-Folgefund] Bis hierher gab
                  es keinen Weg, ein Abo selbst zu verwalten oder zu
                  kuendigen — nur fuer Inhaber sichtbar (dieselbe Grenze wie
                  beim Abschluss) und nur bei einem Tarif, der ueberhaupt
                  ueber Stripe laufen kann. Ein manuell vergebener Tarif ohne
                  Stripe-Kunden faengt die Server Action selbst ab
                  (portalNoCustomer). */}
              {activeOrg?.role === 'owner' && isPurchasableTier(plan.tier) && (
                <form action={openBillingPortal}>
                  <SubmitButton className="text-sm font-medium text-brand-600 hover:underline">
                    {t('manageBilling')}
                  </SubmitButton>
                </form>
              )}
              <Link href="/pricing" className="text-sm font-medium text-brand-600 hover:underline">
                {usage.projects.allowed ? t('planCompare') : t('planUpgrade')}
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* Fuehrt auf den Anlegeschritt statt sofort anzulegen: Wer einen
              Wertstrom aufnimmt, traegt dort erst die Kopfdaten ein und nimmt
              den Erhebungsbogen mit, bevor die leere Zeichenflaeche kommt. Das
              Namensfeld ist damit hier weggefallen — es steht jetzt als erstes
              Feld auf der Anlegeseite. */}
          <Link href="/dashboard/new" className={buttonPrimary}>
            {t('create')}
          </Link>

          {/* Solange die Liste leer ist, traegt der Leerzustand darunter diese
              Handlung als Primaerknopf. Zweimal dasselbe Angebot auf einem
              ansonsten leeren Bildschirm laesst den Nutzer ueberlegen, ob die
              beiden Knoepfe Verschiedenes tun. */}
          {projects && projects.length > 0 && (
            <form action={createExampleProject}>
              <SubmitButton className={buttonSecondary}>{t('loadExample')}</SubmitButton>
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
                    <SubmitButton className={buttonPrimaryLg}>{t('loadExample')}</SubmitButton>
                  </form>
                  <p className="mt-3 text-xs text-zinc-600">
                    {t('emptyHint')}
                  </p>
                  {/* [Marketing-Audit 2026-09-07, A6] Wer gerade ein Projekt
                      anlegt, braucht als Naechstes Daten von der Linie —
                      genau der Moment, in dem der Erhebungsbogen etwas nuetzt,
                      nicht der weit entfernte Link in der Fusszeile. */}
                  <p className="mt-1 text-xs text-zinc-600">
                    {t('emptyDataSheetPrefix')}
                    <Link href="/data-sheet" className="font-medium text-brand-600 hover:underline">
                      {tNav('dataSheet')}
                    </Link>
                    {t('emptyDataSheetSuffix')}
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

        {/* [Marketing-Audit 2026-09-07, C4/C7] Von hier aus gab es keinen Weg
            zurueck ins Marketing — kein Link auf Demo, Erhebungsbogen oder
            Startseite. Wer testen will, ob eine Formel sich seit der Demo
            geaendert hat, oder den Erhebungsbogen fuer eine Kollegin braucht,
            musste die Adresse von Hand eintippen. Der Tarif selbst bleibt im
            Streifen oben verlinkt (planCompare/planUpgrade) und steht hier
            nicht noch einmal. */}
        <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-200 pt-6 text-sm text-zinc-600">
          <Link
            href="/"
            className="font-semibold uppercase tracking-widest text-brand-600 hover:underline"
          >
            {SITE_NAME}
          </Link>
          <Link href="/demo" className="hover:text-brand-600 hover:underline">
            {tNav('demo')}
          </Link>
          <Link href="/data-sheet" className="hover:text-brand-600 hover:underline">
            {tNav('dataSheet')}
          </Link>
        </footer>
      </div>
    </div>
  )
}
