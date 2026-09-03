/**
 * Bestand in Geld.
 *
 * Der Wertstrom rechnet in Stueck: 9 300 zwischen den Stationen, davon 3 200
 * vor dem Fraesen. Fuer die Fertigung ist das die richtige Einheit — fuer den
 * Menschen, der ueber eine Investition entscheidet, ist es keine. Ihn erreicht
 * dieselbe Zahl erst als das, was sie tatsaechlich ist: Geld, das im Regal
 * liegt und nichts verdient.
 *
 * Die Rechnung ist absichtlich eine Multiplikation und keine
 * Bestandskostenrechnung. Lagerzins, Flaeche, Handling und Verschrottung
 * gehoeren in eine Nachkalkulation, nicht in eine Zahl, die im Workshop
 * nebenbei entsteht — und jeder Zuschlag, den das Werkzeug selbst waehlt,
 * waere eine Behauptung, die niemand im Raum nachrechnen kann. Was hier steht,
 * kann jeder pruefen: Stueck mal Wert.
 */

/**
 * Waehrungen, die die Oberflaeche anbietet.
 *
 * Hier und nicht in actions.ts: Eine Datei mit 'use server' darf ausser
 * asynchronen Funktionen nichts exportieren — der Bau bricht sonst ab. Und
 * nicht in der Datenbank als CHECK-Einschraenkung, weil die Frage, welche
 * Auswahl sinnvoll ist, keine Frage des Schemas ist.
 */
export const SUPPORTED_CURRENCIES = ['EUR', 'CHF', 'USD'] as const

export function isSupportedCurrency(code: string): boolean {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}

/** Kein Wert hinterlegt heisst "unbekannt", nicht "null Euro" — deshalb null
 *  und keine 0, damit die Oberflaeche den Unterschied zeigen kann. */
export function tiedUpCapital(totalWipCount: number, pieceValue: number | null): number | null {
  if (pieceValue === null || !Number.isFinite(pieceValue) || pieceValue <= 0) return null
  if (!Number.isFinite(totalWipCount) || totalWipCount < 0) return null
  return totalWipCount * pieceValue
}

/**
 * Was ein Szenario gegenueber dem Ist-Zustand freisetzt.
 *
 * Positiv heisst: Es liegt weniger Geld im Bestand als heute, die Differenz
 * ist wieder verfuegbar. Negativ heisst das Gegenteil, und auch das muss
 * sichtbar sein — ein Supermarkt, der Bestand *aufbaut*, um den Fluss zu
 * sichern, ist eine legitime Entscheidung, aber eine, die etwas kostet.
 */
export function releasedCapital(
  currentCapital: number | null,
  scenarioCapital: number | null
): number | null {
  if (currentCapital === null || scenarioCapital === null) return null
  return currentCapital - scenarioCapital
}

/**
 * Geldbetrag in der Sprache des Lesers, ohne Nachkommastellen.
 *
 * Gerundet auf ganze Einheiten: Ein gebundenes Kapital von 465 000 € ist auf
 * den Cent genau eine Scheingenauigkeit — es steht auf einer Bestandszaehlung
 * und einem geschaetzten Stueckwert. Waehrung als Code (EUR/CHF/USD), damit
 * Intl das Zeichen und seine Stellung selbst waehlt: 465.000 € im Deutschen,
 * €465,000 im Englischen.
 */
export function formatCurrency(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
