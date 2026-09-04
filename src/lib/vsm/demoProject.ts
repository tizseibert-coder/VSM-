import type { Tables } from '@/types/database'
import type { VsmState } from './vsmStore'

type Project = Tables<'projects'>
type Process = Tables<'processes'>
type Buffer = Tables<'inventory_buffers'>

/**
 * Der Datensatz hinter der öffentlichen Demo.
 *
 * Bewusst nicht der Beispiel-Seed aus dashboard/actions.ts: Der schreibt in
 * die Datenbank und braucht eine Organisation. Die Demo läuft ohne Konto und
 * ohne Server, also müssen die Zeilen hier vollständig und fest sein.
 *
 * Die Zahlen sind so gewählt, dass die Demo etwas zu zeigen hat: Die Montage
 * ist mit 4,1 min und 90 % OEE der Engpass, vor Drehen und Fräsen stehen
 * spürbare Bestände, und der Wertschöpfungsanteil landet im Promillebereich —
 * der Wert, an dem sich in einem Workshop die Diskussion entzündet. Ein
 * Wertstrom, auf dem alles im grünen Bereich liegt, wäre eine schlechte Demo.
 */

/** Konstant statt new Date(): Ein Datensatz, der sich bei jedem Aufruf
 *  ändert, macht zwei Momentaufnahmen unvergleichbar. */
const T0 = '2026-01-15T08:00:00.000Z'

const PROJECT_ID = 'demo-project'

/**
 * Die Beschriftungen des Datensatzes — alles, was ein Mensch liest.
 *
 * [Bedienbarkeitspruefung 2026-09-03, B17] Unter /en/demo hiessen die
 * Stationen weiterhin Saegen, Drehen, Fraesen, Entgraten, Montage, und die
 * Firma "Dreherei Musterwerk". Fuer einen englischsprachigen Interessenten
 * sah die Demo dadurch aus wie eine halb fertige Uebersetzung — ausgerechnet
 * an der Stelle, die ohne Anmeldung ueberzeugen soll. Die Zahlen bleiben
 * fest (sie tragen die Aussage der Demo), die Woerter kommen jetzt von
 * aussen.
 */
export type DemoLabels = {
  projectName: string
  description: string
  company: string
  productName: string
  customerName: string
  supplierName: string
  erpLabel: string
  /** Fuenf Stationen, in der Reihenfolge der Kette. */
  processNames: readonly string[]
}

/** Die deutsche Fassung. Sie ist zugleich das, worauf die Tests rechnen. */
export const DEMO_LABELS_DE: DemoLabels = {
  projectName: 'Dreherei Musterwerk',
  description: 'Öffentliche Demo. Änderungen bleiben im Browser und werden nicht gespeichert.',
  company: 'Musterwerk GmbH',
  productName: 'Antriebswelle A-42',
  customerName: 'Kunde',
  supplierName: 'Lieferant',
  erpLabel: 'Produktionssteuerung (ERP)',
  processNames: ['Sägen', 'Drehen', 'Fräsen', 'Entgraten', 'Montage'],
}

function demoProject(labels: DemoLabels): Project {
  return {
    id: PROJECT_ID,
    organization_id: 'demo-org',
    name: labels.projectName,
    description: labels.description,
    company: labels.company,
    product_name: labels.productName,
    customer_name: labels.customerName,
    supplier_name: labels.supplierName,
    erp_label: labels.erpLabel,
    annual_throughput: 50000,
    available_minutes_per_day: 480,
    pitch_minutes: null,
    // Der Materialwert einer Antriebswelle. Er ist der Grund, warum in der Demo
    // neben "9 300 Stueck" auch "465.000 €" steht: Die Stueckzahl ueberzeugt die
    // Fertigung, der Betrag ueberzeugt den, der ueber die Investition
    // entscheidet — und beide sollen in derselben Demo zu sehen sein.
    piece_value: 50,
    currency: 'EUR',
    created_at: T0,
    updated_at: T0,
  }
}

/** Felder, die jeder Prozess gleich hat. Ausgelagert, damit die Zahlen
 *  darunter lesbar bleiben statt in Standardwerten unterzugehen. */
function process(
  id: string,
  name: string,
  values: { cycle_time: number; oee: number; operator_count: number },
  extra: Partial<Process> = {}
): Process {
  return {
    id,
    project_id: PROJECT_ID,
    scenario_id: null,
    name,
    cycle_time: values.cycle_time,
    changeover_time: 0,
    oee: values.oee,
    operator_count: values.operator_count,
    wip: 0,
    lane: 0,
    classification: null,
    color: '#ffffff',
    has_heijunka: false,
    is_pacemaker: false,
    kaizen_note: null,
    origin_process_id: null,
    height: 0,
    width: 0,
    x: null,
    y: null,
    created_at: T0,
    updated_at: T0,
    ...extra,
  }
}

function demoProcesses(labels: DemoLabels): Process[] {
  const n = labels.processNames
  return [
    process('demo-p1', n[0], { cycle_time: 1.2, oee: 82, operator_count: 1 }),
    process('demo-p2', n[1], { cycle_time: 3.4, oee: 78, operator_count: 1 }),
    process('demo-p3', n[2], { cycle_time: 2.6, oee: 85, operator_count: 1 }),
    process('demo-p4', n[3], { cycle_time: 0.9, oee: 95, operator_count: 1 }),
    // Der Schrittmacher sitzt am kundennahen Ende der Kette, wie es die
    // Methodik für einen Prozess mit Kundentakt vorsieht.
    process(
      'demo-p5',
      n[4],
      { cycle_time: 4.1, oee: 90, operator_count: 2 },
      { is_pacemaker: true }
    ),
  ]
}

function buffer(
  id: string,
  from: string | null,
  to: string | null,
  wipCount: number,
  extra: Partial<Buffer> = {}
): Buffer {
  return {
    id,
    project_id: PROJECT_ID,
    scenario_id: null,
    from_process_id: from,
    to_process_id: to,
    wip_count: wipCount,
    buffer_type: null,
    flow_style: null,
    kanban_type: null,
    x: null,
    y: null,
    created_at: T0,
    ...extra,
  }
}

export const DEMO_BUFFERS: Buffer[] = [
  buffer('demo-b0', null, 'demo-p1', 1800),
  buffer('demo-b1', 'demo-p1', 'demo-p2', 2400),
  buffer('demo-b2', 'demo-p2', 'demo-p3', 3200),
  buffer('demo-b3', 'demo-p3', 'demo-p4', 900),
  // Vor dem Schrittmacher gehört methodisch ein Pull-System. Genau hier lässt
  // sich in der Demo zeigen, was die Methodikprüfung meldet, sobald man es auf
  // Push zurückstellt.
  buffer('demo-b4', 'demo-p4', 'demo-p5', 600, { buffer_type: 'supermarket' }),
  buffer('demo-b5', 'demo-p5', null, 400),
]

/** Der vollstaendige Startzustand der Demo in einer Sprache. */
export function buildDemoState(labels: DemoLabels): VsmState {
  return {
    project: demoProject(labels),
    processes: demoProcesses(labels),
    buffers: DEMO_BUFFERS,
  }
}

// Die deutschen Fassungen bleiben als Konstanten erhalten: Die Tests rechnen
// mit ihnen, und sie sind die Vorlage, gegen die eine Uebersetzung geprueft
// wird.
const DEMO_DE = buildDemoState(DEMO_LABELS_DE)
export const DEMO_PROJECT: Project = DEMO_DE.project
export const DEMO_PROCESSES: Process[] = DEMO_DE.processes
