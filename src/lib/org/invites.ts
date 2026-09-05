// Die Angaben, die zu einer Einladung gehoeren, aber nicht in der Einladung
// stehen — und die Auswahl ihrer Gueltigkeitsdauer.
//
// Hier und nicht in team/actions.ts: Eine Datei mit 'use server' darf ausser
// asynchronen Funktionen nichts exportieren (siehe denselben Hinweis in
// lib/vsm/capital.ts). Das Formular im Browser braucht die Auswahl aber
// genauso wie die Action, die sie prueft — und zwei Listen waeren zwei
// Wahrheiten.

/**
 * Die waehlbaren Gueltigkeitsdauern in Tagen.
 *
 * Sieben Tage sind fuer einen Kollegen richtig, den man gleich anschreibt.
 * Fuer die Erprobung sind sie es nicht: Ein Haus, das im Urlaubsmonat
 * angesprochen wird, oeffnet den Link in der dritten Woche — und bekommt
 * „abgelaufen" als ersten Eindruck. Deshalb waehlbar, aber gedeckelt: Ein
 * Link ohne Ablauf ist ein Passwort ohne Ablauf.
 */
export const INVITE_DAY_CHOICES = [7, 14, 30, 60] as const

/** Die Vorgabe, wenn nichts gewaehlt wurde. */
export const INVITE_DAYS_DEFAULT = 7

/** Der laengste Text, den die Einladungsseite noch traegt. Dieselbe Zahl steht
 *  als CHECK-Constraint an der Tabelle. */
export const MAX_WELCOME_LENGTH = 600

/**
 * Wie lang die Einladung gelten soll.
 *
 * Alles ausserhalb der Auswahl faellt auf die Vorgabe zurueck, statt eine
 * Fehlermeldung zu erzeugen: Ein manipuliertes Formularfeld soll nicht laenger
 * gelten, aber auch niemanden aufhalten.
 */
export function inviteDays(value: unknown): number {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return (INVITE_DAY_CHOICES as readonly number[]).includes(parsed) ? parsed : INVITE_DAYS_DEFAULT
}
