import { getActiveOrg } from '@/lib/org/activeOrg'
import { hasMultipleModulesInUse } from '@/lib/org/companyOverview'
import ProjectsPage from '../projects/page'
import CompanyOverview from './CompanyOverview'

/**
 * /dashboard — die Einstiegsseite nach der Anmeldung. Seit
 * docs/plan-company-overview-modules.md eine Weiche, keine eigene Seite
 * mehr: Eine einfache Organisation (noch kein zweites Modul in Benutzung)
 * bekommt unveraendert die VSM-Projektliste direkt, ohne Zwischenschritt —
 * das ist der Hot Path fuer die Person, die live vor einer Gruppe moderiert
 * und am wenigsten Zeit fuer Navigation hat (siehe Plan, Personas-Abschnitt).
 * Eine komplexe Organisation bekommt die Firmenuebersicht mit einer Kachel
 * je Modul.
 *
 * Kein Redirect in beiden Faellen — beide Zweige rendern direkt, damit
 * `/dashboard` fuer den haeufigen (einfachen) Fall keine zusaetzliche
 * Netzwerk-Rundreise kostet.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const orgResult = await getActiveOrg()
  const activeOrg = 'error' in orgResult ? null : orgResult.active
  const allOrgs = 'error' in orgResult ? [] : orgResult.all

  const complex = activeOrg ? await hasMultipleModulesInUse(activeOrg.organizationId) : false

  if (complex && activeOrg) {
    return <CompanyOverview activeOrg={activeOrg} allOrgs={allOrgs} searchParams={searchParams} />
  }

  return <ProjectsPage searchParams={searchParams} />
}
