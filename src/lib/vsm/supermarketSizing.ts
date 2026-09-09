/**
 * Wie gross ein Supermarkt sein muss.
 *
 * Beim Wechsel von Push auf Pull verschwindet der Bestand nicht — er hoert
 * auf, unkontrolliert zu sein, und wird bemessen. Nur echter Fluss
 * (buffer_type 'continuous') ist wirklich null. Dieses Modul liefert die
 * Zahl, die an die Stelle der stehengebliebenen Push-Menge tritt.
 *
 * Drei Stufen, die sich addieren:
 *
 *   Zyklusbestand  Intervall x ADU     Deckt das Nachfuellintervall — wie
 *                                      lange, bis der Vorprozess dieses Teil
 *                                      wieder produziert.
 *   Safety Stock   z x s x Wurzel(PLT) Deckt Streuung, im Bedarf wie in der
 *                                      Durchlaufzeit.
 *   PLT Stock      PLT x ADU           Deckt den Bedarf waehrend der
 *                                      Produktion selbst.
 *
 * Einheiten: ADU und s in Stueck je Tag, Intervall und PLT in Tagen, Ergebnis
 * in Stueck. Das Wurzel(PLT) ist die uebliche Skalierung der Tagesstreuung auf
 * den Vorlaufhorizont (s_LT = s_d x Wurzel(LT)).
 *
 * Bewusst *keine* Ableitung von ADU aus projects.annual_throughput: Das ist
 * der Kundenbedarf des ganzen Stroms, gemittelt ueber ein Jahr. Der ADU eines
 * Supermarkts mitten im Strom ist der Verbrauch dieses Teils an dieser Stelle,
 * getrieben vom nachgelagerten Prozess. Beides gleichzusetzen waere derselbe
 * Fehler, den calculations.ts fuer Bedarfs- und Exitrate schon einmal
 * einsammeln musste. ADU und s kommen deshalb von aussen, gemessen.
 */

import { roundTo } from './numberFormat'

/** z-Wert fuer rund 98 % Servicegrad — die Stufe, auf die der Safety Stock hier ausgelegt ist. */
export const SERVICE_LEVEL_Z = 2.06

/**
 * Woher das Intervall des Zyklusbestands kommt. Aendert nur die Beschriftung
 * und den Vorschlag, nicht die Rechnung: Alle drei sind ein Intervall in Tagen.
 *
 *   epei  Every Part Every Interval — der Rhythmus, in dem der Vorprozess
 *         seine Varianten durchlaeuft.
 *   cti   Cycle Time Interval.
 *   wq    Waiting Queue — die zugelassene Wartezeit.
 */
export type IntervalBasis = 'epei' | 'cti' | 'wq'

export const INTERVAL_BASES: readonly IntervalBasis[] = ['epei', 'cti', 'wq'] as const

export function isIntervalBasis(value: string): value is IntervalBasis {
  return (INTERVAL_BASES as readonly string[]).includes(value)
}

export interface SizingInput {
  /** Average Daily Usage in Stueck/Tag. Gemessen, nicht abgeleitet. */
  aduPerDay: number
  /** Standardabweichung des ADU in Stueck/Tag. Gemessen, nicht geschaetzt. */
  aduStdDev: number
  /** EPEI, CTI oder WQ — in Tagen. */
  intervalDays: number
  /** Prozessdurchlaufzeit in Tagen, am Wertstrom gemessen. */
  pltDays: number
}

export interface SizingResult {
  cycleStock: number
  safetyStock: number
  pltStock: number
  /** Summe, auf ganze Stueck aufgerundet — das ist die Sollgroesse. */
  totalPieces: number
}

/** Eine Eingabe taugt, wenn sie eine endliche Zahl ab null ist. Fehlt eine, gibt es keine Groesse. */
function isUsable(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * Die drei Stufen und ihre Summe.
 *
 * Null heisst "nicht bemessbar", nicht "null Stueck" — dieselbe Unterscheidung,
 * die KpiResult und tiedUpCapital treffen. Eine fehlende Eingabe als 0 zu
 * lesen wuerde einen Supermarkt ausweisen, der leer sein darf.
 *
 * Die Einzelstufen bleiben ungerundet bis auf eine Nachkommastelle, damit die
 * Oberflaeche zeigen kann, woraus die Summe entsteht; aufgerundet wird nur die
 * Summe, und zwar nach oben: Ein halbes Stueck kann nicht im Regal liegen, und
 * Abrunden unterdeckt.
 */
export function sizeSupermarket(input: SizingInput): SizingResult | null {
  const { aduPerDay, aduStdDev, intervalDays, pltDays } = input
  if (![aduPerDay, aduStdDev, intervalDays, pltDays].every(isUsable)) return null

  const cycleStock = intervalDays * aduPerDay
  const safetyStock = SERVICE_LEVEL_Z * aduStdDev * Math.sqrt(pltDays)
  const pltStock = pltDays * aduPerDay

  return {
    cycleStock: roundTo(cycleStock, 1),
    safetyStock: roundTo(safetyStock, 1),
    pltStock: roundTo(pltStock, 1),
    totalPieces: Math.ceil(cycleStock + safetyStock + pltStock),
  }
}

/**
 * Der Deckel einer FIFO-Bahn.
 *
 * Eine FIFO-Bahn ist gedeckelt, nicht bestandsfrei — aber ihr Nachfolger
 * waehlt nicht aus, es gibt also kein Nachfuellintervall zu decken, und die
 * Bahn ist ein Deckel und kein Vorrat gegen Streuung. Bleibt der PLT-Stock
 * allein. Dieselbe Formel wie oben, damit es eine Quelle bleibt.
 */
export function sizeFifoLane(aduPerDay: number, allowedWaitDays: number): number | null {
  if (!isUsable(aduPerDay) || !isUsable(allowedWaitDays)) return null
  return Math.ceil(allowedWaitDays * aduPerDay)
}

/**
 * Vorschlag fuer die PLT eines einzelnen Puffers: die Durchlaufzeit des Stroms
 * ohne den Beitrag, den dieser Puffer selbst dazu leistet.
 *
 * Ohne den Abzug beisst sich die Rechnung in den Schwanz — die Sollgroesse
 * landet als WIP in der PLT, aus der sie berechnet wurde, und beim naechsten
 * Oeffnen stuende eine andere Zahl da. Deshalb hier abziehen und den
 * bestaetigten Wert speichern, statt ihn bei jedem Rendern neu zu ziehen.
 *
 * Nie unter null: Ein Puffer, der rechnerisch die ganze Durchlaufzeit traegt,
 * ergibt 0 Tage Vorlauf, keine negativen.
 */
export function suggestPltDays(
  totalLeadTimeDays: number | null,
  departureRatePerDay: number | null,
  ownWipCount: number
): number | null {
  if (totalLeadTimeDays === null || !Number.isFinite(totalLeadTimeDays)) return null
  if (departureRatePerDay === null || !Number.isFinite(departureRatePerDay) || departureRatePerDay <= 0) {
    return null
  }
  const ownShare = ownWipCount / departureRatePerDay
  return roundTo(Math.max(0, totalLeadTimeDays - ownShare), 2)
}

// ── Der Rechner: eine Reihe Tagesverbraeuche ergibt ADU und s ──────────────
//
// s ist definitionsgemaess die Standardabweichung des ADU, also derselben
// Zahlenreihe. Eine Quelle, zwei Werte — und der einzige ehrliche Weg zu s,
// weil im Schema keine Streuung steht und eine gesetzte Annahme eine
// Behauptung waere, die im Workshop niemand nachrechnen kann.

/**
 * Zahlen aus einer eingefuegten Reihe lesen.
 *
 * Getrennt wird an Zeilenumbruch, Semikolon, Tabulator und Leerzeichen —
 * *nicht* am Komma, denn im Deutschen ist es das Dezimalzeichen. "12,4" und
 * "12.4" sind beide zwoelf Komma vier; eine Zeile, die keine Zahl ergibt,
 * faellt heraus, statt die ganze Reihe zu verwerfen. Das Feld bittet um eine
 * Zahl je Zeile, was dem Einfuegen aus einer Tabellenspalte ohnehin entspricht.
 */
export function parseUsageSeries(raw: string): number[] {
  return raw
    .split(/[\n\r;\t ]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number(token.replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value >= 0)
}

export interface UsageSeriesSummary {
  aduPerDay: number
  aduStdDev: number
  sampleCount: number
}

/**
 * Mittelwert und Stichproben-Standardabweichung (Nenner n-1).
 *
 * Stichprobe, nicht Grundgesamtheit: Was hier eingefuegt wird, sind einige
 * beobachtete Tage, nicht alle. Unter zwei Werten kommt null zurueck — aus
 * einem einzigen Tag laesst sich keine Streuung ableiten, und null sagt das,
 * waehrend eine 0 behaupten wuerde, der Verbrauch schwanke nicht.
 */
export function summariseUsageSeries(values: number[]): UsageSeriesSummary | null {
  if (values.length < 2) return null

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)

  return {
    aduPerDay: roundTo(mean, 2),
    aduStdDev: roundTo(Math.sqrt(variance), 2),
    sampleCount: values.length,
  }
}
