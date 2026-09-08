// Der Wertstrom aus der Demo auf dem Weg ins Konto.
//
// [Marketing-Audit 2026-09-07, A2] Die Demo verwarf ihren Zustand beim
// Neuladen, und der Kommentar in DemoCanvas verteidigte das mit „Ohne Konto
// gibt es keinen Ort, an dem die Aenderungen jemandem gehoeren wuerden".
// Datenschutzrechtlich richtig, verkaeuferisch falsch: Wer zehn Minuten an
// einem Wertstrom gearbeitet hat, hat investiert, und genau diese Investition
// ist der Anmeldegrund — nicht die Funktionsliste.
//
// Die Begruendung stimmt nur, wenn „speichern" *auf dem Server* meint. Im
// Browser gehoeren die Daten weiterhin niemandem ausser dem Nutzer, verlassen
// das Geraet nicht und brauchen keine Einwilligung.
//
// ─────────────────────────────────────────────────────────────────────
// Warum localStorage und nicht sessionStorage
// ─────────────────────────────────────────────────────────────────────
// `sessionStorage` gilt je Tab. Die Registrierung endet aber regelmaessig auf
// /signup/check-email (siehe signup/actions.ts: ohne `data.session` steht eine
// Bestaetigungsmail aus), und der Bestaetigungslink oeffnet einen *anderen*
// Tab. Der Zustand waere genau dann weg, wenn er gebraucht wird.
//
// Dafuer traegt das Format ein Ablaufdatum und wird nach der Uebernahme
// geloescht: Ein Wertstrom, der ein halbes Jahr spaeter in einem fremden
// Browserprofil auftaucht, waere eine Ueberraschung.
//
// ─────────────────────────────────────────────────────────────────────
// Warum das hier so streng prueft
// ─────────────────────────────────────────────────────────────────────
// Was hier zurueckkommt, war im Browser des Nutzers und kommt ueber ein
// Formularfeld an den Server. Es ist damit *fremde Eingabe*, nicht unser
// eigener Zustand — auch wenn wir es selbst geschrieben haben. `parseTransfer`
// nimmt deshalb `unknown` und gibt entweder etwas Vollstaendiges zurueck oder
// `null`. Nichts wird ergaenzt, nichts geraten.

import type { Tables } from '@/types/database'
import type { VsmState } from './vsmStore'

export const DEMO_TRANSFER_KEY = 'vsm_demo_transfer'

/** Aendert sich die Form, faellt Aelteres beim Zuruecklesen durch. */
export const DEMO_TRANSFER_VERSION = 1

/** Sieben Tage. Lang genug fuer „ich schaue morgen im Buero nochmal drauf",
 *  kurz genug, dass niemand von einem halbjahresalten Entwurf ueberrascht
 *  wird. */
export const DEMO_TRANSFER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Obergrenzen. Nicht gegen den ehrlichen Nutzer gerichtet — die Demo hat
 *  fuenf Stationen —, sondern gegen den, der das Feld von Hand fuellt. */
export const MAX_PROCESSES = 40
export const MAX_BUFFERS = 80
export const MAX_TEXT = 200
/** Die serialisierte Form insgesamt. Alles darueber wird gar nicht erst
 *  geparst. */
export const MAX_SERIALIZED_BYTES = 96 * 1024

const BUFFER_TYPES = ['supermarket', 'buffer'] as const
const FLOW_STYLES = ['push', 'pull', 'fifo'] as const
const CLASSIFICATIONS = ['va', 'nva', 'necessary_nva'] as const

export type TransferProcess = {
  name: string
  cycleTime: number
  changeoverTime: number
  oee: number
  operatorCount: number
  wip: number
  lane: number
  isPacemaker: boolean
  hasHeijunka: boolean
  classification: string | null
  x: number | null
  y: number | null
}

export type TransferBuffer = {
  /** Position in `processes`, nicht die Id der Demo: Die gilt nur dort. */
  fromIndex: number | null
  toIndex: number | null
  wipCount: number
  bufferType: string | null
  flowStyle: string | null
  kanbanType: string | null
  x: number | null
  y: number | null
}

export type DemoTransfer = {
  version: number
  savedAt: number
  projectName: string
  description: string | null
  company: string | null
  productName: string | null
  customerName: string
  supplierName: string
  erpLabel: string
  annualThroughput: number | null
  availableMinutesPerDay: number
  pieceValue: number | null
  currency: string
  processes: TransferProcess[]
  buffers: TransferBuffer[]
}

// ─────────────────────────────────────────────────────────────────────
// Hinschreiben
// ─────────────────────────────────────────────────────────────────────

/**
 * Den Zustand der Demo in die Form bringen, die den Weg ueberlebt.
 *
 * Bestaende verweisen ueber die *Position* auf ihre Stationen, nicht ueber
 * deren Id: Die Ids der Demo („demo-p1") gibt es serverseitig nicht, und ein
 * Bestand, der auf eine nicht existierende Station zeigt, waere eine Kante ins
 * Leere.
 */
export function toTransfer(state: VsmState, now: number = Date.now()): DemoTransfer {
  const indexById = new Map(state.processes.map((p, i) => [p.id, i]))

  return {
    version: DEMO_TRANSFER_VERSION,
    savedAt: now,
    projectName: state.project.name,
    description: state.project.description,
    company: state.project.company,
    productName: state.project.product_name,
    customerName: state.project.customer_name,
    supplierName: state.project.supplier_name,
    erpLabel: state.project.erp_label,
    annualThroughput: state.project.annual_throughput,
    availableMinutesPerDay: state.project.available_minutes_per_day,
    pieceValue: state.project.piece_value,
    currency: state.project.currency,
    processes: state.processes.map((p) => ({
      name: p.name,
      cycleTime: p.cycle_time,
      changeoverTime: p.changeover_time,
      oee: p.oee,
      operatorCount: p.operator_count,
      wip: p.wip,
      lane: p.lane,
      isPacemaker: p.is_pacemaker,
      hasHeijunka: p.has_heijunka,
      classification: p.classification,
      x: p.x,
      y: p.y,
    })),
    buffers: state.buffers.map((b) => ({
      fromIndex: b.from_process_id ? (indexById.get(b.from_process_id) ?? null) : null,
      toIndex: b.to_process_id ? (indexById.get(b.to_process_id) ?? null) : null,
      wipCount: b.wip_count,
      bufferType: b.buffer_type,
      flowStyle: b.flow_style,
      kanbanType: b.kanban_type,
      x: b.x,
      y: b.y,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Zurechtlesen
// ─────────────────────────────────────────────────────────────────────

function rec(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Eine Zeichenkette mit Laengenbegrenzung. Leere Angaben gelten als fehlend. */
function str(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length === 0 ? fallback : trimmed.slice(0, MAX_TEXT)
}

function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_TEXT)
}

/**
 * Eine Zahl im erlaubten Bereich.
 *
 * `Number.isFinite` faengt NaN und Unendlich ab — beides kommt aus JSON nicht
 * heraus, wohl aber aus einem von Hand gebauten Feld, und `Infinity` in einer
 * Zykluszeit macht jede Kennzahl dahinter unbrauchbar.
 */
function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

function numOrNull(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(Math.max(value, min), max)
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

/**
 * Fremde Eingabe in ein gueltiges Uebertragungsobjekt — oder `null`.
 *
 * Gibt es die Pflichtteile nicht (Fassung, Zeitstempel, mindestens eine
 * Station), ist das Ergebnis `null`. Alles andere wird auf einen zulaessigen
 * Wert gebracht, statt die Uebernahme daran scheitern zu lassen: Wer eine
 * OEE von 5000 im Feld stehen hat, soll seinen Wertstrom trotzdem bekommen —
 * nur eben mit 100.
 */
export function parseTransfer(input: unknown, now: number = Date.now()): DemoTransfer | null {
  const root = rec(input)
  if (!root) return null

  if (root.version !== DEMO_TRANSFER_VERSION) return null

  const savedAt = root.savedAt
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  // Abgelaufen, oder aus der Zukunft (verstellte Uhr, manipuliertes Feld).
  if (now - savedAt > DEMO_TRANSFER_MAX_AGE_MS) return null
  if (savedAt - now > 24 * 60 * 60 * 1000) return null

  const rawProcesses = Array.isArray(root.processes) ? root.processes : []
  if (rawProcesses.length === 0) return null

  const processes: TransferProcess[] = rawProcesses.slice(0, MAX_PROCESSES).map((raw, i) => {
    const p = rec(raw) ?? {}
    return {
      name: str(p.name, `${i + 1}`),
      cycleTime: num(p.cycleTime, 0, 0, 100_000),
      changeoverTime: num(p.changeoverTime, 0, 0, 100_000),
      // 100 ist die Obergrenze, die auch `capacityCycleTime` annimmt: Eine
      // OEE ueber 100 ist dort ein Eingabefehler ("850" fuer "85").
      oee: num(p.oee, 100, 0, 100),
      operatorCount: Math.round(num(p.operatorCount, 1, 1, 999)),
      wip: Math.round(num(p.wip, 0, 0, 100_000_000)),
      lane: Math.round(num(p.lane, 0, 0, 20)),
      isPacemaker: p.isPacemaker === true,
      hasHeijunka: p.hasHeijunka === true,
      classification: oneOf(p.classification, CLASSIFICATIONS),
      x: numOrNull(p.x, -100_000, 100_000),
      y: numOrNull(p.y, -100_000, 100_000),
    }
  })

  // Genau ein Schrittmacher. Die Regel gilt in der Anwendung ohnehin
  // (actions.ts setzt sie durch); ein Feld mit drei Schrittmachern haette
  // sonst einen Zustand erzeugt, den die Oberflaeche selbst nie herstellt.
  let seenPacemaker = false
  for (const p of processes) {
    if (p.isPacemaker && seenPacemaker) p.isPacemaker = false
    else if (p.isPacemaker) seenPacemaker = true
  }

  const rawBuffers = Array.isArray(root.buffers) ? root.buffers : []
  const validIndex = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isInteger(value)) return null
    return value >= 0 && value < processes.length ? value : null
  }

  const buffers: TransferBuffer[] = rawBuffers.slice(0, MAX_BUFFERS).map((raw) => {
    const b = rec(raw) ?? {}
    return {
      fromIndex: validIndex(b.fromIndex),
      toIndex: validIndex(b.toIndex),
      wipCount: Math.round(num(b.wipCount, 0, 0, 100_000_000)),
      bufferType: oneOf(b.bufferType, BUFFER_TYPES),
      flowStyle: oneOf(b.flowStyle, FLOW_STYLES),
      kanbanType: strOrNull(b.kanbanType),
      x: numOrNull(b.x, -100_000, 100_000),
      y: numOrNull(b.y, -100_000, 100_000),
    }
  })

  return {
    version: DEMO_TRANSFER_VERSION,
    savedAt,
    projectName: str(root.projectName, 'Wertstrom'),
    description: strOrNull(root.description),
    company: strOrNull(root.company),
    productName: strOrNull(root.productName),
    customerName: str(root.customerName, 'Kunde'),
    supplierName: str(root.supplierName, 'Lieferant'),
    erpLabel: str(root.erpLabel, 'ERP'),
    annualThroughput: numOrNull(root.annualThroughput, 0, 1_000_000_000),
    availableMinutesPerDay: num(root.availableMinutesPerDay, 480, 1, 1440),
    pieceValue: numOrNull(root.pieceValue, 0, 1_000_000_000),
    // Drei Zeichen Grossbuchstaben, sonst die Vorgabe: Der Wert geht in eine
    // Waehrungsformatierung, und ein beliebiger String wirft dort.
    currency: /^[A-Z]{3}$/.test(String(root.currency)) ? String(root.currency) : 'EUR',
    processes,
    buffers,
  }
}

/**
 * Die serialisierte Form zurueckelesen, mit Groessengrenze *vor* dem Parsen.
 *
 * Ein 40-MB-Feld waere sonst erst nach `JSON.parse` als zu gross erkannt —
 * also nachdem der Server ihn ausgepackt hat.
 */
export function parseSerializedTransfer(
  raw: string | null | undefined,
  now: number = Date.now()
): DemoTransfer | null {
  if (!raw) return null
  if (raw.length > MAX_SERIALIZED_BYTES) return null

  try {
    return parseTransfer(JSON.parse(raw), now)
  } catch {
    // Kaputtes JSON aus einem halb geschriebenen localStorage-Eintrag ist kein
    // Grund fuer eine Fehlerseite — es gibt dann eben nichts zu uebernehmen.
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────
// Zurueck in einen bedienbaren Zustand
// ─────────────────────────────────────────────────────────────────────

/**
 * Aus dem gespeicherten Stand wieder einen Demo-Zustand machen.
 *
 * Damit stimmt der Hinweisbalken: Er sagt „ein Neuladen setzt die Demo nicht
 * mehr zurueck", und ohne diese Funktion waere das falsch — der Eintrag
 * ueberlebte zwar, die Zeichenflaeche aber zeigte wieder den Ausgangsdatensatz.
 * Ein Nutzer, der so zurueckkommt, saehe die Originaldemo und bekaeme spaeter
 * im Dashboard einen Wertstrom angeboten, den er auf dem Bildschirm nie
 * wiedergesehen hat.
 *
 * Die Ids werden neu vergeben und sind rein oertlich (`demo-…`), wie im
 * Ausgangsdatensatz: In der Demo gibt es keine Datenbank, und der Editor
 * braucht nur eindeutige Schluessel.
 */
export function fromTransfer(transfer: DemoTransfer, template: VsmState): VsmState {
  const t0 = template.project.created_at
  const projectId = template.project.id

  const processes: Tables<'processes'>[] = transfer.processes.map((p, i) => ({
    ...template.processes[0],
    id: `demo-r${i + 1}`,
    project_id: projectId,
    scenario_id: null,
    name: p.name,
    cycle_time: p.cycleTime,
    changeover_time: p.changeoverTime,
    oee: p.oee,
    operator_count: p.operatorCount,
    wip: p.wip,
    lane: p.lane,
    is_pacemaker: p.isPacemaker,
    has_heijunka: p.hasHeijunka,
    classification: p.classification,
    x: p.x,
    y: p.y,
    created_at: t0,
    updated_at: t0,
  }))

  const idAt = (index: number | null): string | null =>
    index === null ? null : (processes[index]?.id ?? null)

  const buffers: Tables<'inventory_buffers'>[] = transfer.buffers.map((b, i) => ({
    ...template.buffers[0],
    id: `demo-rb${i}`,
    project_id: projectId,
    scenario_id: null,
    from_process_id: idAt(b.fromIndex),
    to_process_id: idAt(b.toIndex),
    wip_count: b.wipCount,
    buffer_type: b.bufferType,
    flow_style: b.flowStyle,
    kanban_type: b.kanbanType,
    x: b.x,
    y: b.y,
    created_at: t0,
  }))

  return {
    project: {
      ...template.project,
      name: transfer.projectName,
      description: transfer.description,
      company: transfer.company,
      product_name: transfer.productName,
      customer_name: transfer.customerName,
      supplier_name: transfer.supplierName,
      erp_label: transfer.erpLabel,
      annual_throughput: transfer.annualThroughput,
      available_minutes_per_day: transfer.availableMinutesPerDay,
      piece_value: transfer.pieceValue,
      currency: transfer.currency,
    },
    processes,
    buffers,
  }
}
