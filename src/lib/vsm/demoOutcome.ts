// Was sich zwischen dem Anfangszustand der Demo und dem, was jemand daraus
// gemacht hat, tatsaechlich bewegt hat.
//
// Der Grund fuer diese Datei steht im Marketing-Audit vom 07.09.2026 (A1):
// Die Demo ist der staerkste Verkaufshebel, und der Moment, in dem eine
// Kennzahl auf eine Eingabe reagiert, ist die einzige Stelle im ganzen
// Trichter, an der sich der Zustand des Lesers aendert. Danach endete die
// Seite bisher ohne ein Wort. Der Abschluss darunter braucht eine Aussage,
// die stimmt — also einen Vergleich und nicht die Vermutung, es habe sich
// schon irgendetwas getan.
//
// Rein und ohne React, damit die Aussage pruefbar ist: Was hier heraus kommt,
// steht gleich als Satz auf der Seite, und ein Satz mit falschen Zahlen an
// der Stelle, an der jemand ueber ein Konto nachdenkt, ist teurer als gar
// keiner.

import { calculateKpis, type KpiResult } from './calculations'
import type { VsmState } from './vsmStore'

/**
 * Die Kennzahlen, die den Abschluss tragen duerfen.
 *
 * Bewusst nicht alle vier der Startseite: Die **Taktzeit** fehlt. Sie ist
 * eine Vorgabe des Kunden, keine Eigenschaft der Linie — sie bewegt sich nur,
 * wenn jemand Jahresbedarf oder Schichtmodell aendert, und dann gibt sie
 * lediglich die Eingabe zurueck. "Sie haben die Taktzeit von 3,0 auf 2,4 min
 * gerechnet" waere kein Ergebnis, sondern ein Echo.
 */
export type OutcomeKey = 'leadTime' | 'valueAddedRatio' | 'exitRate'

/**
 * In welche Richtung ist eine Bewegung dieser Kennzahl eine Verbesserung?
 *
 * Steht hier und nicht in der Oberflaeche, weil es eine fachliche Aussage
 * ist: Eine kuerzere Durchlaufzeit ist besser, ein hoeherer
 * Wertschoepfungsanteil auch, eine hoehere Ausbringung ebenfalls.
 */
const LOWER_IS_BETTER: Record<OutcomeKey, boolean> = {
  leadTime: true,
  valueAddedRatio: false,
  exitRate: false,
}

/**
 * Die Reihenfolge, in der eine bewegte Kennzahl die Ueberschrift bekommt.
 *
 * Die Durchlaufzeit zuerst: Sie ist die Zahl, die die Startseite in der
 * Kopfzeile nennt, und die einzige, auf die ein Lean-Praktiker ohne
 * Zwischenrechnung reagiert. Der Wertschoepfungsanteil bewegt sich fast immer
 * mit ihr (er ist Bearbeitungszeit ÷ Durchlaufzeit) und traegt die
 * Ueberschrift nur, wenn die Durchlaufzeit unbekannt ist.
 */
const HEADLINE_ORDER: readonly OutcomeKey[] = ['leadTime', 'valueAddedRatio', 'exitRate']

/** Eine Kennzahl, die sich zwischen zwei Zustaenden bewegt hat. */
export interface OutcomeMetric {
  key: OutcomeKey
  before: number
  after: number
  /**
   * Vorzeichenbehaftete Veraenderung, bezogen auf den Ausgangswert.
   *
   * Null, wenn der Ausgangswert 0 war: Von null auf irgendetwas gibt es
   * keinen Anteil, nur die Bewegung selbst. Die Oberflaeche laesst die
   * Prozentangabe dann weg, statt "∞ %" zu schreiben.
   */
  changePercent: number | null
  /** Zeigt die Bewegung in die Richtung, die ein Wertstrom anstrebt? */
  improved: boolean
}

export interface DemoOutcome {
  /**
   * Hat sich mindestens eine Kennzahl deutlich genug bewegt, dass ein
   * Abschluss gerechtfertigt ist?
   */
  moved: boolean
  /** Die Kennzahl, die den Satz traegt. Null, solange `moved` falsch ist. */
  headline: OutcomeMetric | null
  /** Alle bewegten Kennzahlen in der Reihenfolge von HEADLINE_ORDER. */
  metrics: OutcomeMetric[]
}

/**
 * Unterhalb dieser relativen Abweichung gilt eine Zahl als unveraendert.
 *
 * Fliesskommarechnung: Derselbe Zustand zweimal durch `calculateKpis`
 * geschickt ergibt bitgleiche Werte, die Schwelle faengt also nur den Fall
 * ab, dass zwei rechnerisch gleiche Wege minimal auseinanderlaufen.
 */
const NOISE_EPSILON = 1e-9

/**
 * Ab welcher Bewegung sich ein Abschluss lohnt — ein Prozent.
 *
 * Wer einen Bestand von 1.200 auf 1.201 setzt, hat die Durchlaufzeit um
 * 0,08 % bewegt. Ein Kasten, der daraufhin "Sie haben die Durchlaufzeit von
 * 18,40 auf 18,42 Tage gerechnet" verkuendet, entwertet den Abschluss fuer
 * den Fall, fuer den er gebaut ist. Ein Prozent liegt weit unter jeder
 * ernsthaften Aenderung an einer Zykluszeit und weit ueber dem Rauschen.
 */
const MEANINGFUL_CHANGE_PERCENT = 1

/**
 * Die Kennzahlen eines Demo-Zustands.
 *
 * Derselbe Weg, den auch die Zeichenflaeche geht (siehe VSMCanvas): Jahres-
 * bedarf und Schichtzeit sind Eigenschaften des Projekts und gelten fuer
 * beide Momentaufnahmen gleich — sie kommen deshalb aus dem jeweiligen
 * Zustand und nicht aus einem Zwischenspeicher, sonst rechnete der Vergleich
 * nach einer Aenderung am Schichtmodell gegen zwei verschiedene Nenner.
 */
export function kpisForState(state: VsmState): KpiResult {
  return calculateKpis({
    processes: state.processes.map((p) => ({
      cycleTime: p.cycle_time,
      operatorCount: p.operator_count,
      oee: p.oee,
      wip: p.wip,
    })),
    buffers: state.buffers.map((b) => ({ wipCount: b.wip_count })),
    annualThroughput: state.project.annual_throughput,
    availableMinutesPerDay: state.project.available_minutes_per_day,
  })
}

/**
 * Eine einzelne Bewegung, oder null, wenn es keine vergleichbare gibt.
 *
 * Null auf einer der beiden Seiten heisst "unbekannt", nicht "null" — wer
 * alle Prozesse loescht, hat keine Durchlaufzeit von 0 Tagen, sondern gar
 * keine. Ein Vergleich gegen eine unbekannte Groesse ergibt keine Aussage,
 * und eine erfundene waere schlimmer als keine.
 */
function movement(
  key: OutcomeKey,
  before: number | null,
  after: number | null
): OutcomeMetric | null {
  if (before === null || after === null) return null
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null

  const delta = after - before
  const base = Math.abs(before)

  if (base > 0 && Math.abs(delta) / base < NOISE_EPSILON) return null
  if (base === 0 && delta === 0) return null

  const changePercent = base > 0 ? (delta / base) * 100 : null
  const lowerIsBetter = LOWER_IS_BETTER[key]

  return {
    key,
    before,
    after,
    changePercent,
    improved: lowerIsBetter ? delta < 0 : delta > 0,
  }
}

/** Traegt diese Bewegung einen Abschluss, oder ist sie nur ein Zucken? */
function isMeaningful(metric: OutcomeMetric): boolean {
  // Ohne Prozentangabe (Ausgangswert 0) zaehlt die Bewegung immer: Von "keine
  // Wertschoepfung messbar" auf einen Wert ist die groesste Aenderung, die es
  // in dieser Kennzahl gibt, und ausgerechnet die haette keinen Anteil.
  if (metric.changePercent === null) return true
  return Math.abs(metric.changePercent) >= MEANINGFUL_CHANGE_PERCENT
}

/**
 * Was jemand aus der Demo gemacht hat, gegen den Zustand, in dem er sie
 * vorgefunden hat.
 *
 * Verglichen werden Kennzahlen, nicht Zustaende. Ein verschobener
 * Prozesskasten aendert x und y und sonst nichts — dafuer gibt es keinen
 * Abschluss, weil sich nichts gerechnet hat.
 */
export function compareDemoState(initial: VsmState, current: VsmState): DemoOutcome {
  const before = kpisForState(initial)
  const after = kpisForState(current)

  const candidates: Record<OutcomeKey, OutcomeMetric | null> = {
    leadTime: movement('leadTime', before.totalLeadTimeDays, after.totalLeadTimeDays),
    valueAddedRatio: movement(
      'valueAddedRatio',
      before.valueAddedRatioPercent,
      after.valueAddedRatioPercent
    ),
    exitRate: movement('exitRate', before.exitRatePerDay, after.exitRatePerDay),
  }

  const metrics = HEADLINE_ORDER.map((key) => candidates[key]).filter(
    (metric): metric is OutcomeMetric => metric !== null
  )

  const headline = metrics.find(isMeaningful) ?? null

  return { moved: headline !== null, headline, metrics }
}
