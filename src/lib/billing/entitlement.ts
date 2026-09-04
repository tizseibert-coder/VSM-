// Welcher Tarif fuer eine Organisation gilt, und was davon schon greift.
//
// Die Quelle ist `organization_entitlements` — eine Tabelle der gemeinsamen
// Datenbank, die Prisma/LeanPulse Industrial gehoert (siehe
// supabase/README.md). Der VSM Builder liest sie und schreibt sie nur ueber
// den Verwaltungsbereich; eine eigene Tarif-Tabelle daneben waere eine zweite
// Wahrheit ueber denselben Kunden.
//
// Je Organisation kann dort mehr als eine Zeile stehen — eine je Produkt
// (`AppProduct`). Uns interessiert ausschliesslich `VSM_BUILDER`; die MES-Zeile
// derselben Firma sagt nichts darueber, was hier erlaubt ist.

import { createClient } from '@/lib/supabase/server'
import { isTier, limitsFor, quota, type PlanLimits, type Quota, type Tier } from './plans'

export type Plan = {
  tier: Tier
  limits: PlanLimits
  /** Ob eine ueberschrittene Grenze tatsaechlich blockiert — siehe
   *  `planEnforcementActive()`. */
  enforced: boolean
}

/**
 * Der Schalter, mit dem aus „vorbereitet" „scharf" wird.
 *
 * Aus, solange `VSM_PLAN_ENFORCEMENT` nicht auf `on` steht — und das ist kein
 * unfertiger Zustand, sondern die einzige Reihenfolge, die ohne Schaden geht:
 * Heute hat keine Organisation eine Zeile in `organization_entitlements`, alle
 * gaelten also als FREE. Wer die Durchsetzung mit dem Einspielen dieses Standes
 * anschaltet, nimmt jedem bestehenden Haus am selben Tag die Projekte zwei bis
 * fuenf weg.
 *
 * Die Reihenfolge ist deshalb: einspielen, im Verwaltungsbereich die Tarife
 * der bestehenden Kunden setzen, *dann* `VSM_PLAN_ENFORCEMENT=on`. Bis dahin
 * zeigt die Oberflaeche Verbrauch und Grenze schon an (das ist der Teil, der
 * niemandem etwas wegnimmt), blockiert aber nichts.
 */
export function planEnforcementActive(): boolean {
  return process.env.VSM_PLAN_ENFORCEMENT === 'on'
}

/**
 * Der Tarif einer Organisation. Ohne Zeile: FREE.
 *
 * Auch ein Lesefehler ergibt FREE — nicht, weil das die freundliche Annahme
 * waere, sondern weil die Durchsetzung im Fehlerfall nicht raten soll. Solange
 * `planEnforcementActive()` aus ist, kostet das ohnehin nichts; danach faellt
 * ein Fehler sofort auf, statt still Rechte zu vergeben.
 */
export async function loadPlan(organizationId: string): Promise<Plan> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_entitlements')
    .select('tier, status, granted_at')
    .eq('organization_id', organizationId)
    .eq('product', 'VSM_BUILDER')
    .eq('status', 'ACTIVE')
    // Mehrere aktive Zeilen sollte es nicht geben; wenn doch, gilt die
    // zuletzt vergebene.
    .order('granted_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('loadPlan failed:', error.message)
    return planFrom('FREE')
  }

  return planFrom(data?.tier ?? 'FREE')
}

function planFrom(tier: string | null): Plan {
  // Eine Stufe, die ein anderes Produkt eingefuehrt hat und die hier keine
  // Grenzen hat, wird zu FREE — `limitsFor` faellt ohnehin dorthin zurueck,
  // aber dann soll auch der angezeigte Name stimmen.
  const normalized: Tier = isTier(tier) ? tier : 'FREE'
  return {
    tier: normalized,
    limits: limitsFor(normalized),
    enforced: planEnforcementActive(),
  }
}

export type PlanUsage = {
  projects: Quota
  members: Quota
}

/**
 * Verbrauch gegen Grenze, fuer die Anzeige im Dashboard.
 *
 * Zwei `head: true`-Abfragen statt geladener Zeilen: Gebraucht wird die Zahl,
 * nicht der Inhalt, und die Projektliste daneben laedt ihre Zeilen ohnehin
 * schon.
 */
export async function loadPlanUsage(organizationId: string, plan: Plan): Promise<PlanUsage> {
  const supabase = await createClient()

  const [{ count: projectCount }, { count: memberCount }] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ])

  return {
    projects: quota(projectCount ?? 0, plan.limits.maxProjects),
    members: quota(memberCount ?? 0, plan.limits.maxMembers),
  }
}

/**
 * Die Frage, die jede schreibende Action stellt: darf noch eins dazu?
 *
 * Liefert `true`, solange die Durchsetzung aus ist — die Zaehlung laeuft
 * trotzdem, damit die Anzeige stimmt.
 */
export function mayAdd(plan: Plan, used: number, limit: number | null): boolean {
  if (!plan.enforced) return true
  return quota(used, limit).allowed
}
