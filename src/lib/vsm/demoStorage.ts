// Der Zwischenspeicher der Demo im Browser des Nutzers.
//
// [Marketing-Audit 2026-09-07, A2] Getrennt von `demoTransfer.ts`, weil die
// Form und ihre Pruefung auch serverseitig gebraucht werden — dort gibt es
// kein `window`. Hier steht ausschliesslich der Zugriff auf den Speicher.
//
// Jeder Zugriff liegt in try/catch. Das ist keine Vorsicht auf Vorrat: Im
// privaten Fenster und bei gesperrten Website-Daten *wirft* schon der Zugriff
// auf `localStorage` selbst, nicht erst das Schreiben. Eine Demo, die im
// privaten Fenster mit einem weissen Bildschirm endet, waere ein teurer Preis
// fuer eine Bequemlichkeit.

import { DEMO_TRANSFER_KEY, toTransfer } from './demoTransfer'
import type { VsmState } from './vsmStore'

/** Der rohe Eintrag, so wie er auf die Reise zum Server geht. */
export function readRawDemoTransfer(): string | null {
  try {
    return window.localStorage.getItem(DEMO_TRANSFER_KEY)
  } catch {
    return null
  }
}

/** Schreibt den aktuellen Stand. Schlaegt das fehl, laeuft die Demo weiter —
 *  nur eben ohne Uebernahme. */
export function writeDemoTransfer(state: VsmState): void {
  try {
    window.localStorage.setItem(DEMO_TRANSFER_KEY, JSON.stringify(toTransfer(state)))
  } catch {
    // Voller Speicher oder gesperrte Website-Daten. Kein Fall fuer eine
    // Meldung: Der Nutzer hat nichts falsch gemacht und koennte auch nichts
    // tun.
  }
}

/**
 * Der Stand, mit dem dieser Seitenaufruf begonnen hat.
 *
 * Einmal gelesen und dann festgehalten — und das ist der Punkt: Die Demo
 * schreibt bei jeder Aenderung in denselben Schluessel. Eine Momentaufnahme,
 * die jedes Mal frisch aus dem Speicher liest, aenderte sich damit bei jedem
 * Tastendruck, und `useSyncExternalStore` zeichnete endlos nach. Gebraucht
 * wird aber nur die eine Frage: Lag beim Oeffnen schon etwas da?
 *
 * Der Zwischenspeicher gilt je geladenem Modul, also je Seitenaufruf. Ein
 * echtes Neuladen liest neu.
 */
let initialRaw: string | null | undefined
export function readInitialDemoTransfer(): string | null {
  if (initialRaw === undefined) initialRaw = readRawDemoTransfer()
  return initialRaw
}

/**
 * Kein Abonnement: Der Anfangsstand aendert sich innerhalb eines
 * Seitenaufrufs nicht mehr. `useSyncExternalStore` verlangt trotzdem eine
 * Abmeldefunktion.
 */
export function subscribeNever(): () => void {
  return () => {}
}

/**
 * Auf Aenderungen am Eintrag horchen.
 *
 * Fuer `useSyncExternalStore`: Der `localStorage` ist genau die Art
 * Aussenwelt, fuer die dieser Haken gebaut ist. Das `storage`-Ereignis feuert,
 * wenn ein *anderer* Tab schreibt oder loescht — wer die Demo in einem zweiten
 * Tab uebernimmt, soll hier kein Angebot mehr sehen, das es nicht mehr gibt.
 */
export function subscribeToDemoTransfer(onChange: () => void): () => void {
  try {
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
  } catch {
    return () => {}
  }
}

/** Nach der Uebernahme, beim Verwerfen und bei einem unlesbaren Eintrag. */
export function clearDemoTransfer(): void {
  try {
    window.localStorage.removeItem(DEMO_TRANSFER_KEY)
  } catch {
    // s. o.
  }
}
