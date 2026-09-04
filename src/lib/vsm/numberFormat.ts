/**
 * Zahlen in der Sprache des Lesers.
 *
 * Der Editor hat seine Kennzahlen bisher mit `toFixed()` gesetzt — an
 * einundvierzig Stellen. Das Ergebnis war "84.5 Tage", "2.4 min" und
 * "0.03 %" in einer deutschen Oberflaeche, waehrend die Startseite daneben
 * korrekt "16,8 Tage" schrieb, weil sie als einzige `Intl.NumberFormat`
 * benutzte. Fuer ein Werkzeug, dessen ganzes Verkaufsargument Zahlen sind,
 * ist das kein Schoenheitsfehler: Ein deutscher Fertigungsleiter liest
 * "84.5" zuerst als Tippfehler und dann als Hinweis darauf, dass hier etwas
 * uebersetzt und nicht gebaut wurde.
 *
 * Die Rundung bleibt eine fachliche Entscheidung und steht dort, wo die Zahl
 * entsteht (eine Zykluszeit auf eine Nachkommastelle, ein
 * Wertschoepfungsanteil auf zwei). Hier steht nur, wie sie geschrieben wird.
 */

/**
 * Feste Anzahl Nachkommastellen, wie `toFixed` — nur eben mit dem
 * Dezimalzeichen und der Tausendertrennung der Sprache.
 *
 * Bewusst mit `minimumFractionDigits`: "2,0 min" statt "2 min" haelt die
 * Ziffern in einer Spalte von Kacheln untereinander, und eine Kennzahl, die
 * ihre Genauigkeit wechselt, sieht aus wie ein Fehler.
 */
export function formatDecimal(value: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Die Zahl so schreiben, wie sie ist — nur mit dem Dezimalzeichen der
 * Sprache. Fuer Werte, die jemand selbst eingetippt hat (Zykluszeit,
 * Ruestzeit, OEE): 0,75 bleibt 0,75 und wird nicht auf 0,8 gerundet, 12
 * bleibt 12 und bekommt keine Null angehaengt.
 */
export function formatPlain(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

/** Ganze Stueck: 9300 wird zu "9.300" — bei Bestaenden in der Fertigung ist
 *  die Tausendertrennung der Unterschied zwischen Lesen und Zaehlen. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

/** Kaufmaennisch runden, damit die Rundung dort bleibt, wo die Zahl entsteht,
 *  und die Anzeige nur noch schreibt, was sie bekommt. */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Die Werte einer ICU-Nachricht fuer die Anzeige aufbereiten.
 *
 * next-intl reicht eine Zahl in `{platzhalter}` unformatiert durch — aus 9300
 * wird "9300" und nicht "9.300". Wer die Nachricht mit Zahlen fuettert, muss
 * sie also selbst formatieren; diese Funktion tut das fuer einen ganzen Satz
 * Werte auf einmal, damit an der Aufrufstelle keine Liste von Feldnamen
 * gepflegt werden muss. Zeichenketten bleiben unangetastet.
 */
export function formatValues(
  values: Record<string, string | number>,
  locale: string
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    out[key] = typeof value === 'number' ? formatPlain(value, locale) : value
  }
  return out
}
