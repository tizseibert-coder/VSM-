/**
 * Das Schichtmodell hinter den verfuegbaren Minuten pro Tag.
 *
 * Bisher trug ein Projekt nur eine nackte Zahl: 480, 900, 1350. Sie speist
 * ueber calculateKpis die Taktzeit und damit alles, was daran haengt — aber
 * sie sagt niemandem, wie sie zustande kam. Ein Fertigungsleiter weiss nicht
 * "900 Minuten", er weiss "zwei Schichten zu 450 Minuten netto". Aus der Zahl
 * allein laesst sich das nicht zurueckrechnen: 900 koennen zwei Schichten zu
 * 450 oder drei zu 300 sein, und die beiden Faelle bedeuten in einem Workshop
 * voellig Verschiedenes.
 *
 * Deshalb stehen Schichtzahl und Nettozeit je Schicht als eigene Angaben da
 * und rechnen die Minuten aus. Die gerechnete Zahl bleibt aber ueberschreibbar:
 * Wer eine gemessene Nettozeit hat, die nicht dem Modell entspricht — geplante
 * Wartung, eine kurze Schicht am Freitag — traegt sie ein und behaelt sie.
 *
 * available_minutes_per_day bleibt dabei der eine Wert, den alles liest. Diese
 * Datei rechnet ihn nur aus und meldet, wenn Modell und Wert auseinanderlaufen;
 * sie ersetzt ihn nicht durch eine zweite Quelle.
 */

export interface ShiftModel {
  /** Anzahl Schichten pro Tag. Null heisst "nicht angegeben". */
  shiftCount: number | null
  /** Nettominuten je Schicht, also ohne Pausen. Null heisst "nicht angegeben". */
  netMinutesPerShift: number | null
}

function isUsable(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

/** Vollstaendig heisst: Beide Angaben stehen da und ergeben zusammen einen Tag. */
export function hasShiftModel(model: ShiftModel): boolean {
  return isUsable(model.shiftCount) && isUsable(model.netMinutesPerShift)
}

/**
 * Netto-Minuten pro Tag aus dem Modell.
 *
 * Null, solange eine der beiden Angaben fehlt — "unbekannt", nicht "null
 * Minuten". Eine 0 hier wuerde die Taktzeit auf null Minuten setzen und damit
 * jede Kennzahl darueber unbrauchbar machen.
 */
export function deriveAvailableMinutes(model: ShiftModel): number | null {
  if (!hasShiftModel(model)) return null
  return (model.shiftCount as number) * (model.netMinutesPerShift as number)
}

/**
 * Was das Schichtmodell ergaebe, wenn der eingetragene Wert nicht dazu passt.
 *
 * Null heisst "kein Widerspruch": entweder gibt es kein vollstaendiges Modell,
 * oder der Wert stammt aus ihm, oder er stimmt zufaellig damit ueberein. Die
 * Oberflaeche zeigt die Abweichung als Hinweis an, nicht als Fehler — von Hand
 * abzuweichen ist erlaubt, es soll nur niemandem entgehen.
 *
 * Der Vergleich laeuft auf ganze Minuten, damit eine Nettozeit von 449,999
 * keinen Hinweis ausloest, den niemand nachvollziehen kann.
 */
export function shiftModelDeviation(
  availableMinutesPerDay: number,
  model: ShiftModel
): number | null {
  const derived = deriveAvailableMinutes(model)
  if (derived === null) return null
  if (Math.round(derived) === Math.round(availableMinutesPerDay)) return null
  return derived
}
