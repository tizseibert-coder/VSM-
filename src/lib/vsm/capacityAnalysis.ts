// CAMA — die Kapazitaetsampel einer Linie ueber alle 12 Monate eines Jahres.
//
// Beantwortet eine andere Frage als capacity.ts: checkCapacity() dort prueft,
// ob eine Station *jetzt* der Engpass gegen die eine Kundentaktzeit des
// Projekts ist (Ist-Zustand, eine Zahl). CAMA prueft, ob die Monatskapazitaet
// einer Linie ueber das ganze Jahr fuer die jeweilige Monatsnachfrage reicht
// (12 Zahlen, saisonal). Beide duerfen fuer dieselbe Station unterschiedliche
// Ampeln zeigen — das ist kein Widerspruch, sondern zwei verschiedene Fragen
// (siehe docs/plan-cama-capacity-analysis.md, Abschnitt "Abgrenzung zu
// capacity.ts").
//
// Eine CAMA-Linie ist ein VSM-Prozess: Taktrate kommt aus cycle_time (Minuten
// je Stueck), NEE aus oee (hier bereits als Anteil 0-1 uebergeben, nicht als
// Prozent) — keine neue Bedeutung, nur die bereits bestehenden Groessen in
// der von CAMA gebrauchten Form.

export type ShiftModel = 1 | 2 | 3

/** Stunden/Tag je Schichtmodell. 1-Schicht = 8.2h, 2-Schicht = 16.4h (beide
 *  mit Pausenabzug), 3-Schicht = 24h (durchlaufend). */
const SHIFT_HOURS_PER_DAY: Record<ShiftModel, number> = {
  1: 8.2,
  2: 16.4,
  3: 24,
}

export function shiftHoursPerDay(shift: ShiftModel): number {
  return SHIFT_HOURS_PER_DAY[shift]
}

/** Arbeitstage/Monat, wenn im firmenweiten Kalender (vsm_org_settings.capacity_workdays)
 *  ein Monat fehlt oder die Spalte ganz leer ist — der Normalzustand jeder
 *  bestehenden Firma. Eine Annahme statt einer stillen 0, die jede Load Rate
 *  faelschlich auf Infinity zoege. */
export const DEFAULT_WORKDAYS_PER_MONTH = 21

export interface CamaLineInput {
  /** Minuten je Stueck — dieselbe Groesse wie processes.cycle_time. */
  cycleTimeMinutes: number
  /**
   * Parallele, wirklich identische Arbeitsplaetze (flexible Linie/gleichartige
   * Arbeitsplatzgruppen) — dieselbe Konvention wie in calculations.ts:
   * effectiveCycleTime. Nur unter dieser Bedingung darf operatorCount > 1
   * gesetzt sein (siehe Plan, Abschnitt "operator_count in der Taktrate");
   * die Pruefung dieser Bedingung liegt beim Nutzer bei der Eingabe, nicht in
   * dieser Funktion. Default 1.
   */
  operatorCount?: number
  /** NEE als Anteil 0-1 (oee/100), nicht als Prozent. */
  neeFraction: number
  shiftModel: ShiftModel
}

/**
 * Monatskapazitaet in Stueck: Stunden/Tag x Taktrate x NEE x Arbeitstage.
 * 0 statt Infinity/NaN bei ungueltiger Zykluszeit oder NEE = 0 — "keine
 * Kapazitaet" ist eine reale Aussage, keine Rechenpanne.
 */
export function calcMonthlyCapacity(input: CamaLineInput, workdays: number): number {
  if (input.cycleTimeMinutes <= 0 || input.neeFraction <= 0 || workdays <= 0) return 0

  const operatorCount = input.operatorCount && input.operatorCount > 0 ? input.operatorCount : 1
  const effectiveCycleTime = input.cycleTimeMinutes / operatorCount
  const piecesPerHour = 60 / effectiveCycleTime
  const dailyCapacity = shiftHoursPerDay(input.shiftModel) * piecesPerHour * input.neeFraction

  return dailyCapacity * workdays
}

/**
 * Load Rate = Nachfrage / Monatskapazitaet. Ohne Nachfrage ist die Zahl 0
 * (unterausgelastet), unabhaengig von der Kapazitaet — keine Nachfrage heisst
 * nicht "unbekannt". Mit Nachfrage aber ohne Kapazitaet (0) ist die Linie
 * unerreichbar ueberlastet: Infinity, dieselbe Konvention wie eine NEE von 0
 * in calculations.ts (capacityCycleTime).
 */
export function calcLoadRate(demand: number, monthlyCapacity: number): number {
  if (demand <= 0) return 0
  if (monthlyCapacity <= 0) return Infinity
  return demand / monthlyCapacity
}

export type CamaColor = 'blue' | 'green' | 'orange' | 'red'

/**
 * Ampel-Grenzen (Nutzerentscheidung 2026-09-14, siehe Plan): der Schwellwert
 * selbst gehoert noch zur guenstigeren Farbe. 1.00 ist die letzte gruene
 * Stufe, 1.20 die letzte orange.
 */
export function getCamaColor(loadRate: number): CamaColor {
  if (loadRate < 0.5) return 'blue'
  if (loadRate <= 1.0) return 'green'
  if (loadRate <= 1.2) return 'orange'
  return 'red'
}

export interface CamaMonthResult {
  /** 1 = Januar .. 12 = Dezember. */
  month: number
  demand: number
  capacity: number
  loadRate: number
  color: CamaColor
}

export interface CamaLineResult {
  months: CamaMonthResult[]
  /** Der Monat mit der hoechsten Load Rate — nicht zwingend der spaeteste im
   *  Jahr. Bestimmt die Ampelfarbe der ganzen Linie, siehe `color`. */
  peakMonth: CamaMonthResult
  color: CamaColor
}

/**
 * Rechnet eine Linie ueber alle 12 Monate. `monthlyDemand` und
 * `workdaysByMonth` muessen 12 Eintraege haben (Index 0 = Januar); fehlende
 * Monate sind Sache des Aufrufers (siehe resolveMonthlyValues unten) — diese
 * Funktion bleibt bewusst rein und trifft keine Annahme ueber fehlende Werte.
 */
export function calcCamaLine(
  input: CamaLineInput,
  monthlyDemand: number[],
  workdaysByMonth: number[]
): CamaLineResult {
  const months: CamaMonthResult[] = monthlyDemand.map((demand, index) => {
    const workdays = workdaysByMonth[index] ?? DEFAULT_WORKDAYS_PER_MONTH
    const capacity = calcMonthlyCapacity(input, workdays)
    const loadRate = calcLoadRate(demand, capacity)
    return { month: index + 1, demand, capacity, loadRate, color: getCamaColor(loadRate) }
  })

  const peakMonth = months.reduce((worst, month) => (month.loadRate > worst.loadRate ? month : worst))

  return { months, peakMonth, color: peakMonth.color }
}

/**
 * Fuellt einen luecken- oder leerhaften Kalender (processes.monthly_demand
 * bzw. vsm_org_settings.capacity_workdays, beide jsonb und ungeprueft — siehe
 * Migration) auf 12 Eintraege auf. Fehlende oder ungueltige Werte werden zu
 * `fallback`, nicht stillschweigend zu 0: eine fehlende Monatsnachfrage ist
 * "nicht erfasst", keine "Nachfrage null".
 */
export function resolveMonthlyValues(raw: unknown, fallback: number): number[] {
  const array = Array.isArray(raw) ? raw : []
  return Array.from({ length: 12 }, (_, index) => {
    const value = array[index]
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  })
}

/**
 * Wie resolveMonthlyValues, aber fuer den firmenweiten Kalender: der steht
 * als jsonb-Objekt {"1":21,...,"12":22} und nicht als Array, weil einzelne
 * Monate unabhaengig voneinander gepflegt werden (siehe Migration).
 */
export function resolveWorkdaysCalendar(
  raw: unknown,
  fallback: number = DEFAULT_WORKDAYS_PER_MONTH
): number[] {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return Array.from({ length: 12 }, (_, index) => {
    const value = record[String(index + 1)]
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
  })
}
