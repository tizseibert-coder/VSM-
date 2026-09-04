// Die Tarifstufen und was sie erlauben.
//
// Die Namen sind nicht frei gewaehlt: `Tier` ist ein Aufzaehlungstyp der
// gemeinsamen Datenbank (FREE, BETA, STARTER, PROFESSIONAL, ENTERPRISE) und
// gilt fuer alle drei Produkte auf demselben Login. Was eine Stufe im *VSM
// Builder* bedeutet, steht hier — und nur hier. Zwei Listen mit Grenzwerten
// (eine fuer die Verkaufsseite, eine fuer die Durchsetzung) waeren zwei
// Wahrheiten, die irgendwann auseinanderlaufen; die Preistabelle liest
// dieselben Zahlen wie `createProject`.

export type Tier = 'FREE' | 'BETA' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

export const TIERS: readonly Tier[] = ['FREE', 'BETA', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']

/**
 * Die Stufen, die auf der Preisseite stehen. BETA fehlt mit Absicht: Sie ist
 * eine Vergabe des Betreibers an einzelne Haeuser waehrend der Erprobung, kein
 * Angebot, das man buchen kann.
 */
export const PUBLIC_TIERS: readonly Tier[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']

/** `null` heisst unbegrenzt — nicht `0` und nicht `Infinity`: Der eine Wert
 *  waere „nichts erlaubt", der andere im JSON der Datenbank nicht darstellbar. */
export type PlanLimits = {
  maxProjects: number | null
  maxScenariosPerProject: number | null
  maxMembers: number | null
  /** Branchenvergleich (BenchmarkPanel). */
  benchmark: boolean
  /** Prozessschritte aus einer CSV uebernehmen. */
  csvImport: boolean
  /** PDF-Ausgabe. In jeder Stufe enthalten — das Ergebnis eines Workshops ist
   *  das Blatt Papier, und ein Werkzeug, das seine eigene Ausgabe einsperrt,
   *  wird im Workshop nicht das zweite Mal geoeffnet. */
  pdfExport: boolean
}

const PLANS: Record<Tier, PlanLimits> = {
  // Ein vollstaendiger Wertstrom mit einem Szenario dagegen: genug, um im
  // eigenen Werk zu zeigen, dass die Rechnung aufgeht. Die Grenze ist die
  // Breite (wie viele Wertstroeme), nicht die Tiefe — ein halber Wertstrom
  // beweist nichts.
  FREE: {
    maxProjects: 1,
    maxScenariosPerProject: 1,
    maxMembers: 2,
    benchmark: false,
    csvImport: false,
    pdfExport: true,
  },
  // Erprobung: wie PROFESSIONAL, aber vom Betreiber vergeben und befristet.
  BETA: {
    maxProjects: null,
    maxScenariosPerProject: null,
    maxMembers: 25,
    benchmark: true,
    csvImport: true,
    pdfExport: true,
  },
  STARTER: {
    maxProjects: 5,
    maxScenariosPerProject: 3,
    maxMembers: 5,
    benchmark: false,
    csvImport: true,
    pdfExport: true,
  },
  PROFESSIONAL: {
    maxProjects: 50,
    maxScenariosPerProject: null,
    maxMembers: 25,
    benchmark: true,
    csvImport: true,
    pdfExport: true,
  },
  ENTERPRISE: {
    maxProjects: null,
    maxScenariosPerProject: null,
    maxMembers: null,
    benchmark: true,
    csvImport: true,
    pdfExport: true,
  },
}

/** Unbekannte Werte fallen auf FREE zurueck statt zu werfen: Eine neue Stufe
 *  im gemeinsamen Aufzaehlungstyp (die ein anderes Produkt eingefuehrt hat)
 *  darf hier nicht die Projektliste sprengen. */
export function limitsFor(tier: string | null | undefined): PlanLimits {
  return PLANS[tier as Tier] ?? PLANS.FREE
}

export function isTier(value: string | null | undefined): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value)
}

export type Quota = {
  used: number
  limit: number | null
  /** Ob noch *eine weitere* Einheit hineinpasst. */
  allowed: boolean
  /** Wie viele noch passen; `null` bei unbegrenzt. */
  remaining: number | null
}

/**
 * Der eine Rechenschritt, den jede Grenze braucht.
 *
 * Bewusst „passt noch eine weitere hinein" und nicht „ist die Grenze
 * ueberschritten": Gefragt wird immer vor dem Anlegen. Wer schon darueber
 * liegt (Grenze nachtraeglich gesenkt, Tarif ausgelaufen), verliert nichts —
 * er darf nur nichts Neues mehr anlegen.
 */
export function quota(used: number, limit: number | null): Quota {
  if (limit === null) return { used, limit: null, allowed: true, remaining: null }
  return {
    used,
    limit,
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
  }
}

/**
 * Die Rangfolge der Stufen — fuer „ab welchem Tarif gibt es das".
 *
 * BETA liegt bewusst *ueber* PROFESSIONAL und unter ENTERPRISE, weil sie
 * dessen Umfang hat; sie ist in dieser Ordnung nur enthalten, damit ein
 * Vergleich nicht ins Leere laeuft, nicht als Kaufweg.
 */
const RANK: Record<Tier, number> = {
  FREE: 0,
  STARTER: 1,
  PROFESSIONAL: 2,
  BETA: 3,
  ENTERPRISE: 4,
}

export function tierRank(tier: string | null | undefined): number {
  return RANK[tier as Tier] ?? 0
}

/** Die Merkmale, die es entweder gibt oder nicht — im Unterschied zu den
 *  Zahlgrenzen, die jede Stufe hat, nur in anderer Hoehe. */
export type BooleanFeature = {
  [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never
}[keyof PlanLimits]

/** Die guenstigste oeffentliche Stufe, die ein Merkmal enthaelt — die Angabe
 *  „ab Starter", die in einem Hinweis steht, wenn etwas gesperrt ist. Gibt
 *  `null` zurueck, wenn keine oeffentliche Stufe es hat. */
export function lowestTierWith(feature: BooleanFeature): Tier | null {
  const ordered = [...PUBLIC_TIERS].sort((a, b) => tierRank(a) - tierRank(b))
  return ordered.find((tier) => PLANS[tier][feature]) ?? null
}

export { PLANS }
