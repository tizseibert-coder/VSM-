'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Stage,
  Layer,
  Rect,
  Text as KonvaText,
  Group,
  Arrow,
  Line,
  RegularPolygon,
  Circle,
  Star,
} from 'react-konva'
import type Konva from 'konva'
import type { Tables } from '@/types/database'
import { calculateKpis, effectiveCycleTime, SHIFT_MINUTES } from '@/lib/vsm/calculations'
import { BalanceChartPanel } from './BalanceChartPanel'
import BenchmarkPanel from './BenchmarkPanel'
import { MethodCheckPanel } from './MethodCheckPanel'
import { useLocale, useTranslations } from 'next-intl'
import { rankFindings, type MethodFinding } from '@/lib/vsm/methodCheck'
import { buttonPrimaryLg, buttonSecondaryLg, inputSm } from '@/components/ui/buttons'
import { useDemoMutate } from './DemoModeContext'
import { demoOperations } from '@/lib/vsm/demoStore'
import { TierChip } from './TierChip'
import type { BenchmarkTier } from '@/lib/vsm/benchmark'
import { ratePce, rateCapacityCoverage } from '@/lib/vsm/kpiRating'
import { bufferGapIndices, findBuffer } from '@/lib/vsm/buffers'
import { splitSegmentAroundGap, zigzagPoints, type Point } from '@/lib/vsm/geometry'
import { computeAutoFitScale, clampScale, MIN_READABLE_SCALE } from '@/lib/vsm/viewport'
import { checkCapacity } from '@/lib/vsm/capacity'
import { findPushBeforePacemaker } from '@/lib/vsm/pacemakerConsistency'
import { TermTooltip } from './TermTooltip'
import { deriveChainOrder, moveInOrder, wouldCreateCycle } from '@/lib/vsm/chainOrder'
import { CLASSIFICATION, classificationMarker, type ClassificationValue } from '@/lib/vsm/classification'
import {
  buildKpiSummaryLines,
  buildPdfSubtitle,
  buildPdfTitle,
} from '@/lib/vsm/pdfSummary'
import jsPDF from 'jspdf'
import {
  customerCloudPosition,
  supplierCloudPosition,
  erpBoxPosition,
  boxRightEdge,
  boxLeftEdge,
  midpoint,
  slotPosition,
  laneY,
  PROCESS_WIDTH,
  PROCESS_HEIGHT,
  BUFFER_SIZE,
  CLOUD_SIZE,
  ERP_WIDTH,
  ERP_HEIGHT,
  heijunkaBoxPosition,
  HEIJUNKA_WIDTH,
  HEIJUNKA_HEIGHT,
} from '@/lib/vsm/autoLayout'
import {
  addProcess,
  deleteProcess,
  importProcessesCsv,
  updateAnnualThroughput,
  updateAvailableMinutes,
  updateProcess,
  reorderProcesses,
  updateProcessLane,
  setBufferWip,
  deleteBufferConnection,
  updateProjectLabels,
} from '@/app/[locale]/editor/[projectId]/actions'

type Project = Tables<'projects'>
type Process = Tables<'processes'>
type BenchmarkReference = Tables<'benchmark_reference'>
type Buffer = Tables<'inventory_buffers'>

const INK = '#18181b' // zinc-900 — used for all VSM line-art instead of pure black
const ACCENT = '#17786c' // brand-500 — Auswahl, die einzige Schmuckfarbe auf dem Canvas
const BOTTLENECK = '#dc2626' // capacity-warning red — semantic, kept distinct from the accent
const EMPTY_BUFFER = '#a1a1aa' // zinc-400 — an empty buffer slot, present but not asserting stock

// Konva zeichnet auf ein <canvas> und setzt dafür `ctx.font` als fertige
// Zeichenkette — CSS-Variablen kennt es nicht, und ohne fontFamily nimmt es
// stillschweigend seinen eigenen Standard: Arial. Das betraf nicht nur den
// Bildschirm, sondern auch den PDF-Export, der aus derselben Stage entsteht.
const CANVAS_FONT_FALLBACK = 'system-ui, "Segoe UI", Roboto, sans-serif'

/**
 * Liest den von next/font erzeugten Schriftstapel aus dem Dokument. Der Name
 * der Familie wird beim Bauen generiert (`__Geist_a1b2c3`) und steht nur im
 * CSS — deshalb hier abgefragt statt fest verdrahtet. Serverseitig gibt es
 * kein Dokument; dort greift der Rückfallstapel.
 */
function resolveCanvasFont(): string {
  if (typeof document === 'undefined') return CANVAS_FONT_FALLBACK
  return getComputedStyle(document.body).fontFamily || CANVAS_FONT_FALLBACK
}

/**
 * Alle Beschriftungen auf der Zeichenfläche laufen über diesen Wrapper, damit
 * die Schrift an einer einzigen Stelle gesetzt wird und keine Textmarke sie
 * versehentlich auslässt. `props` steht bewusst hinter der Vorgabe: ein
 * Aufrufer darf die Familie weiterhin überschreiben.
 */
function Text(props: ComponentProps<typeof KonvaText>) {
  return <KonvaText fontFamily={resolveCanvasFont()} {...props} />
}

/**
 * Die Schriftgroessen der Zeichenflaeche, vier Stufen. Vorher waren es sechs
 * (8, 8.5, 10, 11, 12, 13) ueber sechzehn Textmarken verteilt — eine Skala,
 * die beim Schreiben entstand statt entschieden zu werden (Design-Audit
 * 2026-08-31, Befund 05).
 *
 * Die Zahlen sind Canvas-Einheiten, nicht Pixel: Sie skalieren mit Zoom und
 * PDF-Export mit, weshalb hier andere Werte stehen als in der Oberfläche
 * (dort ist 12 px die Untergrenze, siehe globals.css). Massgeblich ist das
 * gedruckte A3, auf dem das Diagramm groesser steht als am Bildschirm.
 */
const CANVAS_TEXT = {
  /** 13 — was aus zwei Metern lesbar sein muss: Prozessname, die beiden
   *  Summen der Zeitleiter. */
  heading: 13,
  /** 11 — einzelne Zahlen und Namen in einem Symbol: Bedienerzahl, WIP,
   *  Lieferant/Kunde, ERP-Kasten. */
  value: 11,
  /** 10 — Beschriftungen und die Datenzeilen im Prozesskasten. */
  label: 10,
  /** 8 — Kuerzel in engen Symbolen, wo mehr nicht hineinpasst: "SS",
   *  Kanban-Art, Klassifikationsmarke. */
  tag: 8,
} as const

/**
 * Zusaetzliche Trefferflaeche rund um jedes Bestandsdreieck (siehe
 * BufferMarker), in Canvas-Einheiten je Seite. BUFFER_SIZE (50) allein
 * ergibt am Zoom-Boden MIN_READABLE_SCALE (60 %) nur 30x30 px — unter den
 * ueblichen 44 px fuer einen Finger. 12 Einheiten je Seite heben die
 * effektive Groesse auf 74, also 44,4 px bei genau diesem Zoom.
 */
const BUFFER_HIT_PADDING = 12
const LADDER_HIGH_STEP = 40
const LADDER_MARGIN_TOP = 70
const SUMMARY_WIDTH = 100 // matches LadderSummary's box width (84) + margin
// Canvas display height is derived from the diagram's own content height
// (see canvasHeight below), clamped to this range — small so a 1-2-process
// VSM isn't a mostly-empty box, large so a many-lane diagram still gets
// capped and shrunk-to-fit (via computeAutoFitScale) instead of growing
// the page without bound.
const MIN_CANVAS_DISPLAY_HEIGHT = 320
// Rueckfallwert, solange das Fenster noch nicht gemessen ist (Serverlauf und
// erstes Bild). Danach uebernimmt maxCanvasDisplayHeight.
const MAX_CANVAS_DISPLAY_HEIGHT = 560
// Höhe der Kennzahlenleiste, die im Vollbild unten andockt. Sie belegt den
// Platz, den das Diagramm ohnehin nicht füllen kann, und beantwortet damit im
// Moderationsmodus die Frage, für die man sonst das Vollbild verlassen musste:
// was macht die Durchlaufzeit, wenn ich diese Box gerade ändere.
const FULLSCREEN_KPI_BAR_HEIGHT = 92
// Was im Seitenfluss oberhalb der Zeichenflaeche kleben bleibt: die fuenf
// Kennzahlenkacheln samt Formelzeile und die Werkzeugleiste. Im Browser
// gemessen sind das 271 px; der Aufschlag deckt die Kacheln ab, die bei
// schlechter Bewertung eine Zeile mehr tragen ("Verbesserungsbedarf").
//
// Der Wert deckelt die Zeichenflaeche, damit sie nicht hoeher wird als der
// Platz unter der klebenden Leiste — sonst muesste man scrollen, um das
// Diagramm ganz zu sehen, und genau dabei verschwindet es hinter der Leiste.
const STICKY_CHROME_HEIGHT = 320

/**
 * Die zwei Auswertungen unter dem Diagramm, in Lesereihenfolge. Nur die
 * Kennung steht hier; die Beschriftung kommt aus dem Editor-Namensraum.
 */
const ANALYSIS_TABS = [
  { id: 'balance', labelKey: 'tabBalance' },
  { id: 'benchmark', labelKey: 'tabBenchmark' },
] as const

type Selection =
  | { kind: 'process'; id: string }
  | { kind: 'buffer'; from: string | null; to: string | null }
  | { kind: 'anchor'; anchor: 'supplier' | 'customer' | 'erp' }
  | null

interface Props {
  project: Project
  /** null = current/live state; a scenarios.id = editing that Future-State copy. */
  scenarioId: string | null
  /**
   * Name des aktiven Szenarios, nur für die Zustandsangabe im PDF. Die ID
   * allein genügt dafür nicht, und ein Ausdruck ohne Zustandsangabe ist im
   * Gremium wertlos — siehe buildPdfSubtitle.
   */
  scenarioName?: string | null
  initialProcesses: Process[]
  initialBuffers: Buffer[]
  /**
   * Vergleichswerte fuer den Branchenvergleich. Leer heisst "keine
   * hinterlegt" — dann entfaellt der Reiter, statt einen leeren zu zeigen.
   * Die oeffentliche Demo laeuft ohne.
   */
  benchmarkReferences?: BenchmarkReference[]
}

export default function VSMCanvas({
  project,
  scenarioId,
  scenarioName = null,
  initialProcesses,
  initialBuffers,
  benchmarkReferences = [],
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Editor')
  const tCanvas = useTranslations('Canvas')
  const tMethod = useTranslations('MethodCheck')
  const tPdf = useTranslations('Pdf')
  const hasBenchmark = benchmarkReferences.length > 0
  const router = useRouter()
  const demoMutate = useDemoMutate()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)

  // Der Schriftstapel steht schon beim ersten Bild fest (die CSS-Variable wird
  // beim Bauen gesetzt), die Schriftdatei selbst kann aber später eintreffen.
  // Konva zeichnet dann einmal mit der Rückfallschrift und käme von selbst
  // nie darauf zurück — anders als DOM-Text wird ein Canvas bei
  // `font-display: swap` nicht neu gezeichnet. Ein Durchlauf nach
  // `fonts.ready` erzwingt genau ein Nachzeichnen.
  const [, setFontLoaded] = useState(false)
  useEffect(() => {
    let active = true
    document.fonts?.ready.then(() => {
      if (active) setFontLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])
  // Phase 7b: Präsentationsmodus. Bewusst weiterhin voll editierbar (echte
  // VSM-Workshops entstehen live mit dem Team im Raum) — blendet nur
  // Nebensächliches aus, das während einer Moderation nie gebraucht wird
  // (CSV-Bulk-Import, Lieferant/Kunde/ERP-Label-Umbenennung). Prozess- und
  // Puffer-Boxen bleiben anklickbar und editierbar wie im Normalmodus.
  const [presentationMode, setPresentationMode] = useState(false)

  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddCt, setQuickAddCt] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [throughputInput, setThroughputInput] = useState(
    project.annual_throughput?.toString() ?? ''
  )
  const [availableMinutesInput, setAvailableMinutesInput] = useState(
    String(project.available_minutes_per_day)
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Zoom/pan camera state: the world (canvasWidth x canvasHeight, computed
  // below) is drawn at a fixed size and a scale/offset transforms it into a
  // fixed-size viewport. `camera` is null until the user explicitly zooms,
  // pans, or clicks "Einpassen" — until then the view is *derived* fresh
  // every render from the current content size, so a growing diagram keeps
  // shrinking to fit automatically without needing an effect to chase it.
  const [camera, setCamera] = useState<{ scale: number; pos: Point } | null>(null)

  // [UX-Audit 2026-08-16, P3] Vollbild. Im Seitenfluss konkurrieren zwei
  // Bewegungsräume um dieselbe Geste: die Seite scrollt vertikal, das
  // Diagramm lässt sich verschieben. Am Telefon nimmt die Zeichenfläche dabei
  // nur die Hälfte des Sichtfelds ein — man bewegt ständig das Falsche. Im
  // Vollbild gibt es nur noch einen Bewegungsraum, das Problem verschwindet
  // statt gemildert zu werden.
  // Welche der beiden Auswertungen unter dem Diagramm gerade zu sehen ist.
  // Beide standen frueher gleichzeitig im Stapel darunter (Design-Audit
  // 2026-08-31, Befund 06); wer den Benchmark lesen wollte, scrollte an der
  // Austaktung vorbei, und das Diagramm war laengst aus dem Bild.
  const [analysisTab, setAnalysisTab] = useState<'balance' | 'benchmark'>('balance')
  // [UX-Audit 2026-08-16, P6] "Strg/Cmd + Mausrad zum Zoomen" stand bisher
  // dauerhaft da — ein Dauerhinweis ist das Eingestaendnis, dass eine
  // Interaktion nicht auffindbar ist, und kostet Aufmerksamkeit bei allen,
  // die es laengst wissen. Er blendet sich jetzt nur ein, wenn jemand ohne
  // Strg/Cmd ueber der Zeichenflaeche scrollt (siehe handleWheel), und dann
  // nur fuer zwei Sekunden.
  const [showZoomHint, setShowZoomHint] = useState(false)
  const zoomHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Nur im Vollbild gebraucht: dort bestimmt der Bildschirm die Höhe, sonst
  // leitet sie sich aus der Diagrammhöhe ab (viewportHeight weiter unten).
  const [measuredHeight, setMeasuredHeight] = useState(0)
  // Only the width is measured (depends on the container's rendered CSS
  // width, not computable from data). The height is derived below from the
  // diagram's own content height — a fixed height here was the cause of a
  // reported bug: a small VSM left a lot of empty white canvas between the
  // diagram and the toolbar underneath it, because a short diagram already
  // "fits" a tall fixed viewport at 100% scale and just sits at the top.
  const [viewportWidth, setViewportWidth] = useState(900)
  // Die Fensterhoehe entscheidet im Seitenfluss darueber, wie hoch die
  // Zeichenflaeche werden darf. 0 heisst "noch nicht gemessen" (Serverlauf);
  // dann greift der feste Rueckfallwert.
  const [windowHeight, setWindowHeight] = useState(0)
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const processes = initialProcesses
  const buffers = initialBuffers

  // The pacemaker (Schrittmacher) is the one process that gets scheduled
  // directly from production control — everything else is pulled via
  // kanban/FIFO. Until one is set, fall back to dispatching to every
  // process (the old behavior) so existing/example VSMs don't go blank.
  const pacemaker = processes.find((p) => p.is_pacemaker) ?? null
  const dispatchProcesses = pacemaker ? [pacemaker] : processes

  // Canonical order: walked from the buffer graph (supplier -> ... ->
  // customer), not created_at and not any stored x/y. Every process box's
  // position is *derived* from its slot in this order plus its lane — there
  // is no manual dragging, so boxes can never overlap or drift off-grid.
  const chainOrder = useMemo(
    () => deriveChainOrder(processes.map((p) => p.id), buffers.map((b) => ({ from: b.from_process_id, to: b.to_process_id }))),
    [processes, buffers]
  )
  const orderedProcesses = useMemo(
    () => chainOrder.map((id) => processes.find((p) => p.id === id)).filter((p): p is Process => !!p),
    [chainOrder, processes]
  )
  const maxLane = processes.reduce((m, p) => Math.max(m, p.lane), 0)

  // Methodology check: everything feeding the pacemaker should be pulled
  // (supermarket/FIFO), not plain push — see findPushBeforePacemaker.
  const pushBeforePacemaker = useMemo(
    () =>
      pacemaker
        ? findPushBeforePacemaker(
            chainOrder,
            pacemaker.id,
            buffers.map((b) => ({
              fromProcessId: b.from_process_id,
              toProcessId: b.to_process_id,
              bufferType: b.buffer_type,
              flowStyle: b.flow_style,
            }))
          )
        : [],
    [pacemaker, chainOrder, buffers]
  )

  const positions = useMemo(() => {
    const map: Record<string, Point> = {}
    orderedProcesses.forEach((p, index) => {
      map[p.id] = slotPosition(index, p.lane)
    })
    return map
  }, [orderedProcesses])

  const liveAnnualThroughput = useMemo(() => {
    const trimmed = throughputInput.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isNaN(n) ? null : n
  }, [throughputInput])

  const liveAvailableMinutes = useMemo(() => {
    const n = Number(availableMinutesInput.trim())
    return Number.isNaN(n) || n <= 0 ? undefined : n
  }, [availableMinutesInput])

  const kpis = useMemo(
    () =>
      calculateKpis({
        // oee travels with the process now: the exit rate is set by the
        // slowest station *after* its availability/performance/quality losses,
        // not by its nominal cycle time.
        processes: processes.map((p) => ({
          cycleTime: p.cycle_time,
          operatorCount: p.operator_count,
          oee: p.oee,
          wip: p.wip ?? undefined,
        })),
        buffers: buffers.map((b) => ({ wipCount: b.wip_count })),
        annualThroughput: liveAnnualThroughput,
        availableMinutesPerDay: liveAvailableMinutes,
      }),
    [processes, buffers, liveAnnualThroughput, liveAvailableMinutes]
  )

  // Alle Methodikbefunde an einer Stelle, damit sie eine gemeinsame Rangfolge
  // bekommen können. Nur die Unterdeckung ist `critical`: Sie ist der einzige
  // Befund, der eine oben angezeigte Kennzahl entwertet — bei unter 100 %
  // wächst der Bestand unbegrenzt, damit gilt Little's Law nicht mehr und die
  // Durchlaufzeit ist die Momentaufnahme einer wandernden Zahl. Die beiden
  // anderen sind Darstellungsfehler: methodisch falsch, aber die Zahlen
  // daneben stimmen.
  const methodFindings = useMemo<MethodFinding[]>(() => {
    const found: MethodFinding[] = []

    if (kpis.capacityCoverage !== null && kpis.capacityCoverage < 1) {
      found.push({
        id: 'capacity-coverage',
        severity: 'critical',
        title: tMethod('capacityShortfallTitle', {
          percent: (kpis.capacityCoverage * 100).toFixed(0),
        }),
        detail: tMethod('capacityDetail', {
          exit: kpis.exitRatePerDay?.toFixed(1) ?? '',
          demand: kpis.demandRatePerDay?.toFixed(1) ?? '',
        }),
      })
    }

    if (!pacemaker && processes.length > 0) {
      found.push({
        id: 'no-pacemaker',
        severity: 'warning',
        title: tMethod('noPacemakerTitle'),
        detail: tMethod('noPacemakerDetail'),
      })
    }

    if (pushBeforePacemaker.length > 0) {
      found.push({
        id: 'push-before-pacemaker',
        severity: 'warning',
        title: tMethod('pushTitle', { count: pushBeforePacemaker.length }),
        detail: tMethod('pushDetail'),
      })
    }

    return found
  }, [kpis, pacemaker, processes.length, pushBeforePacemaker.length, tMethod])

  // Live transparency for the "how is this actually calculated" question —
  // shown as a small formula caption under Durchlaufzeit/Taktzeit so a
  // surprising number (e.g. a very low Jahresbedarf making PLT look huge)
  // is visibly explained by its own inputs instead of looking like a bug.
  const totalWipCount = useMemo(() => buffers.reduce((sum, b) => sum + b.wip_count, 0), [buffers])
  const effectiveAvailableMinutes = liveAvailableMinutes ?? SHIFT_MINUTES
  // Each caption names the divisor it actually used. Lead time divides by the
  // *departure* rate (the smaller of Ausbringung and Kundenbedarf), takt by the
  // customer demand — naming both prevents the confusion that produced the old
  // single "Exitrate" label for two different quantities.
  const leadTimeFormula =
    kpis.departureRatePerDay !== null
      ? t('leadTimeFormula', {
          wip: totalWipCount,
          rate: kpis.departureRatePerDay.toFixed(1),
        })
      : undefined
  const taktTimeFormula =
    kpis.demandRatePerDay !== null
      ? t('taktTimeFormula', {
          minutes: effectiveAvailableMinutes,
          demand: kpis.demandRatePerDay.toFixed(1),
        })
      : undefined
  const exitRateFormula =
    kpis.bottleneckCycleTimeMinutes !== null && Number.isFinite(kpis.bottleneckCycleTimeMinutes)
      ? t('exitRateFormula', {
          minutes: effectiveAvailableMinutes,
          bottleneck: kpis.bottleneckCycleTimeMinutes.toFixed(2),
        })
      : undefined

  const supplierPos = supplierCloudPosition()
  const supplierRight: Point = {
    x: supplierPos.x + CLOUD_SIZE,
    y: supplierPos.y + (CLOUD_SIZE * 0.75) / 2,
  }
  const customerPos = customerCloudPosition(processes.length)
  const customerLeft: Point = { x: customerPos.x, y: customerPos.y + (CLOUD_SIZE * 0.75) / 2 }
  const erpPos = erpBoxPosition(processes.length)
  const heijunkaPos = heijunkaBoxPosition(processes.length)

  // Sits below whichever lane is drawn lowest, so it never overlaps a
  // parallel row.
  const ladderLowY = laneY(maxLane) + PROCESS_HEIGHT + LADDER_MARGIN_TOP
  const ladderHighY = ladderLowY - LADDER_HIGH_STEP

  const canvasWidth = Math.max(900, customerPos.x + CLOUD_SIZE + 60 + SUMMARY_WIDTH)
  const canvasHeight = ladderLowY + 60
  // The viewport reserved the *unscaled* content height while the content is
  // drawn at the fit scale, so a diagram fitted to 70 % left roughly a third of
  // the card empty underneath it. Reserve the height the content will actually
  // occupy instead. A VSM grows sideways, so the width drives the fit — taking
  // the scale from the width alone also avoids the circular dependency between
  // viewport height and auto-fit scale.
  const widthFitScale = Math.max(MIN_READABLE_SCALE, Math.min(1, (viewportWidth - 48) / canvasWidth))
  // [Design-Audit 2026-08-31, Befund 06] Die Obergrenze war eine feste Zahl
  // (560 px), unabhaengig vom Bildschirm: Auf einem 1080er-Notebook blieb ein
  // Drittel des Bildes ungenutzt, waehrend das Diagramm darin auf 60 %
  // geschrumpft wurde. Sie richtet sich jetzt nach dem Fenster abzueglich
  // dessen, was oben kleben bleibt.
  const maxCanvasDisplayHeight =
    windowHeight > 0
      ? Math.max(MIN_CANVAS_DISPLAY_HEIGHT, windowHeight - STICKY_CHROME_HEIGHT)
      : MAX_CANVAS_DISPLAY_HEIGHT
  const viewportHeight = Math.min(
    maxCanvasDisplayHeight,
    Math.max(MIN_CANVAS_DISPLAY_HEIGHT, canvasHeight * widthFitScale + 32)
  )

  // Dieselben Werte wie in den Kacheln oberhalb der Zeichenfläche, nur
  // kompakt. Bewusst aus einer Quelle abgeleitet: Zwei Stellen, die dieselbe
  // Zahl unterschiedlich formatieren, laufen früher oder später auseinander.
  const fullscreenKpis = useMemo(
    () => [
      {
        label: t('kpiLeadTime'),
        value: kpis.totalLeadTimeDays !== null ? kpis.totalLeadTimeDays.toFixed(1) : KPI_EMPTY,
        unit: t('unitDays'),
      },
      {
        label: t('kpiPce'),
        value:
          kpis.valueAddedRatioPercent !== null
            ? kpis.valueAddedRatioPercent.toFixed(2)
            : KPI_EMPTY,
        unit: '%',
      },
      {
        label: t('kpiTaktTime'),
        value: kpis.taktTimeMinutes !== null ? kpis.taktTimeMinutes.toFixed(1) : KPI_EMPTY,
        unit: t('unitMin'),
      },
      {
        label: t('kpiExitRate'),
        value: kpis.exitRatePerDay !== null ? kpis.exitRatePerDay.toFixed(1) : KPI_EMPTY,
        unit: t('unitPiecesPerDay'),
      },
      {
        label: t('kpiCycleTimeSum'),
        value: kpis.totalCycleTimeMinutes.toFixed(1),
        unit: t('unitMin'),
      },
    ],
    [kpis, t]
  )

  // Die Höhe, in die eingepasst wird: im Seitenfluss die aus dem Inhalt
  // abgeleitete Kartenhöhe, im Vollbild der Bildschirm abzüglich der
  // Kennzahlenleiste, die dort unten andockt.
  const stageHeight =
    isFullscreen && measuredHeight > 0
      ? Math.max(200, measuredHeight - FULLSCREEN_KPI_BAR_HEIGHT)
      : viewportHeight

  // Fit-scale/position for the current content size — recomputed every
  // render (cheap arithmetic), not stored in state. This is what "Einpassen"
  // resets to, and what's shown automatically before the user ever touches
  // zoom/pan, including right after adding the diagram's first processes.
  const autoFitScale = computeAutoFitScale(
    { width: canvasWidth, height: canvasHeight },
    { width: viewportWidth, height: stageHeight },
    24
  )
  // Waagrecht war schon immer zentriert, senkrecht stand das Diagramm fest bei
  // y = 16. Im Seitenfluss stimmt das, weil die Kartenhöhe aus dem Inhalt
  // abgeleitet ist und es gar keinen Überschuss gibt. Im Vollbild nicht: Ein
  // Wertstrom ist breit und flach, also bestimmt die Breite den Massstab, und
  // darunter bleibt zwangsläufig Platz — das Diagramm kann die Höhe gar nicht
  // füllen, ohne seitlich herauszulaufen. Oben angeschlagen sah das aus wie ein
  // halb geladenes Bild; zentriert sieht es aus wie ein Blatt.
  const autoFitPos: Point = {
    x: (viewportWidth - canvasWidth * autoFitScale) / 2,
    y: Math.max(16, (stageHeight - canvasHeight * autoFitScale) / 2),
  }
  const stageScale = camera?.scale ?? autoFitScale
  const stagePos = camera?.pos ?? autoFitPos

  function handleFitToView() {
    setCamera(null) // back to automatic — also resumes auto-shrinking as the diagram grows
  }

  // PDF-Export v1 (Phase 8): single page, canvas snapshot + KPI block —
  // deliberately not the full multi-page report from the original master
  // prompt (that's its own future pass). Client-side only: Konva's own
  // toDataURL() rasterizes exactly what's on screen, no server round-trip
  // or separate re-render needed.
  function handleExportPdf() {
    const stage = stageRef.current
    if (!stage) return
    setIsExportingPdf(true)
    try {
      // [Fehlerbericht 31.08.2026, iPhone 16] Der Export zeigte nur einen
      // Ausschnitt: ERP, "Montieren", "Verpacken" — Zeitleiter und halbe Kette
      // fehlten. Ursache: toDataURL() rastert den *sichtbaren* Bereich der
      // Bühne. Am Schreibtisch fällt das nie auf, weil das eingepasste
      // Diagramm dort hineinpasst (Bühne 1102 px, skalierter Inhalt 1059 px).
      // Auf 375 px ist die Bühne rund 327 px breit, der Maßstab aber bei
      // MIN_READABLE_SCALE (0.6) gedeckelt — von 1059 px Inhalt blieb knapp
      // ein Drittel übrig. Dasselbe passiert auf jedem Gerät, sobald jemand
      // verschoben oder hineingezoomt hat.
      //
      // Ein Ausdruck darf nicht davon abhängen, wohin gerade gescrollt wurde.
      // Also: Bühne kurz auf Originalmaßstab und Inhaltsgrösse stellen,
      // aufnehmen, zurückstellen. Der Nutzer sieht davon nichts, weil zwischen
      // den beiden Zuständen kein Bild ausgegeben wird.
      const restore = {
        scale: stage.scaleX(),
        position: stage.position(),
        width: stage.width(),
        height: stage.height(),
      }
      let dataUrl: string
      try {
        stage.scale({ x: 1, y: 1 })
        stage.position({ x: 0, y: 0 })
        stage.size({ width: canvasWidth, height: canvasHeight })
        stage.draw()
        // Ein sehr breiter Wertstrom ergäbe bei festem Faktor 2 ein Bild von
        // mehreren tausend Pixeln Kantenlänge; das Blatt gewinnt dadurch
        // nichts, und manche Browser brechen beim Rastern ab.
        dataUrl = stage.toDataURL({
          pixelRatio: Math.min(2, 4000 / canvasWidth),
          mimeType: 'image/png',
        })
      } finally {
        stage.scale({ x: restore.scale, y: restore.scale })
        stage.position(restore.position)
        stage.size({ width: restore.width, height: restore.height })
        stage.draw()
      }

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 32
      // Kopf- und Fusszeile brauchen festen Platz, dazwischen bleibt der Rest
      // fürs Diagramm.
      const headerSpace = 52
      const kpiBlockSpace = 58
      const footerSpace = 28
      // Die Methodikbefunde gehören aufs Blatt: Es geht ins Lenkungsgremium,
      // und dort ist der Unterschied zwischen "die Zahlen sind belastbar" und
      // "eine Kennzahl steht unter Vorbehalt" entscheidungsrelevant. Der Platz
      // wird nur abgezogen, wenn es Befunde gibt — sonst schrumpfte das
      // Diagramm auch auf einem methodisch sauberen Wertstrom.
      const rankedFindings = rankFindings(methodFindings)
      const findingsSpace = rankedFindings.length === 0 ? 0 : 24 + rankedFindings.length * 13

      // --- Kopfzeile ------------------------------------------------------
      // Das Blatt verlässt die Anwendung und landet bei Leuten, die sie nie
      // öffnen werden. Es muss deshalb aus sich heraus sagen, was es ist, von
      // welchem Zustand es spricht und woher es stammt.
      pdf.setFontSize(7.5)
      pdf.setTextColor(15, 90, 82) // brand-600
      pdf.text('VSM BUILDER', margin, margin)

      pdf.setFontSize(15)
      pdf.setTextColor(24, 24, 27) // INK
      pdf.text(buildPdfTitle(project.name, tPdf('documentTitle')), margin, margin + 18)

      pdf.setFontSize(9.5)
      pdf.setTextColor(82, 82, 91) // zinc-600
      pdf.text(
        buildPdfSubtitle(scenarioName, {
          currentState: tPdf('currentState'),
          futureState: (name) => tPdf('futureState', { name }),
        }),
        margin,
        margin + 32
      )

      pdf.setDrawColor(212, 212, 216) // zinc-300
      pdf.setLineWidth(0.5)
      pdf.line(margin, margin + 40, pageWidth - margin, margin + 40)

      // --- Diagramm -------------------------------------------------------
      const imgProps = pdf.getImageProperties(dataUrl)
      const availableWidth = pageWidth - margin * 2
      const maxImgHeight =
        pageHeight - margin * 2 - headerSpace - kpiBlockSpace - findingsSpace - footerSpace
      let imgWidth = availableWidth
      let imgHeight = (imgProps.height / imgProps.width) * imgWidth
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight
        imgWidth = (imgProps.width / imgProps.height) * imgHeight
      }
      const imgX = margin + (availableWidth - imgWidth) / 2
      const imgY = margin + headerSpace
      // Ohne dieses Argument bettet jsPDF das Bild unkomprimiert ein: Der
      // erste echte Export war 9,1 MB, und 3530 x 860 x 3 Byte ergeben genau
      // diese 9,1 MB — das Bild war die Datei. Ein Blatt in dieser Groesse
      // scheitert an den Anhangsgrenzen vieler Firmen-Mailgateways, also
      // ausgerechnet dort, wo es hinsoll. Strichzeichnung komprimiert sehr
      // gut, 'FAST' genuegt und haelt den Export auch auf dem Telefon zuegig.
      pdf.addImage(dataUrl, 'PNG', imgX, imgY, imgWidth, imgHeight, undefined, 'FAST')

      // --- Kennzahlen -----------------------------------------------------
      // Als Spalten statt als Liste, damit sie sich wie auf dem Bildschirm
      // vergleichen lassen. Der Inhalt kommt weiterhin aus der geprüften
      // buildKpiSummaryLines; hier wird nur am ersten ": " in Beschriftung und
      // Wert getrennt. Beide Seiten sind fest formatiert (Begriff bzw. Zahl
      // mit Einheit), ein zweites ": " kann darin nicht vorkommen.
      const kpiLines = buildKpiSummaryLines(kpis, {
        cycleTimeSum: t('kpiCycleTimeSum'),
        leadTime: t('kpiLeadTime'),
        pce: t('kpiPce'),
        taktTime: t('kpiTaktTime'),
        unitMin: t('unitMin'),
        unitDays: t('unitDays'),
        unitPercent: t('unitPercent'),
      })
      const columnWidth = availableWidth / kpiLines.length
      const kpiY = imgY + imgHeight + 30
      kpiLines.forEach((line, i) => {
        const separator = line.indexOf(': ')
        const label = line.slice(0, separator)
        const value = line.slice(separator + 2)
        const x = margin + columnWidth * i

        pdf.setFontSize(8)
        pdf.setTextColor(82, 82, 91)
        pdf.text(label, x, kpiY)

        pdf.setFontSize(14)
        pdf.setTextColor(24, 24, 27)
        pdf.text(value, x, kpiY + 17)
      })

      // --- Methodikprüfung ------------------------------------------------
      // Nur die Titel, nicht die Begründungen: Das Blatt soll benennen, was zu
      // klären ist, nicht die Schulung ersetzen. Der Punkt vor der Zeile trägt
      // dieselbe Bedeutung wie im Panel — rot heisst, dass eine der Zahlen
      // darüber unter Vorbehalt steht.
      if (rankedFindings.length > 0) {
        let findingY = kpiY + kpiBlockSpace - 16

        pdf.setFontSize(8)
        pdf.setTextColor(82, 82, 91)
        pdf.text(
          `${tPdf('methodCheckHeading')} · ${tMethod('hintCount', { count: rankedFindings.length })}`,
          margin,
          findingY
        )
        findingY += 14

        for (const finding of rankedFindings) {
          if (finding.severity === 'critical') {
            pdf.setFillColor(163, 42, 31) // dasselbe Rot wie die Engpass-Markierung
          } else {
            pdf.setFillColor(180, 83, 9) // Bernstein wie die Hinweisbanner
          }
          pdf.circle(margin + 2, findingY - 2.5, 2, 'F')

          pdf.setFontSize(9)
          pdf.setTextColor(24, 24, 27)
          // Ein Titel wie "2× Push vor dem Schrittmacher statt Supermarkt oder
          // FIFO" passt in eine Zeile; ein Projektname darin könnte ihn
          // sprengen. splitTextToSize schneidet nicht ab, sondern umbricht —
          // die zusätzliche Zeile ist im Platz nicht eingerechnet, deshalb
          // wird nur die erste gesetzt und der Rest fällt weg, statt in die
          // Fusszeile zu laufen.
          const [firstLine] = pdf.splitTextToSize(finding.title, pageWidth - margin * 2 - 14)
          pdf.text(firstLine, margin + 12, findingY)
          findingY += 13
        }
      }

      // --- Fusszeile ------------------------------------------------------
      const footerY = pageHeight - margin
      pdf.setDrawColor(212, 212, 216)
      pdf.line(margin, footerY - 14, pageWidth - margin, footerY - 14)
      pdf.setFontSize(8)
      pdf.setTextColor(82, 82, 91)
      // buildPdfFooterLine() stand frueher hier und formatierte dd.mm.yyyy
      // fest. Sowohl das Datumsformat als auch der Satz haengen an der
      // Sprache, deshalb beides ueber Intl bzw. den Pdf-Namensraum.
      pdf.text(
        tPdf('footer', {
          date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date()),
        }),
        margin,
        footerY
      )
      pdf.text(project.name, pageWidth - margin, footerY, { align: 'right' })

      pdf.save(`${project.name || 'vsm'}.pdf`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Measure the viewport (container width, fixed height) on mount and on
  // resize, so the stage always fills its card without native scrolling.
  useEffect(() => {
    function measure() {
      const el = stageContainerRef.current
      if (!el) return
      // Eine Breite von 0 ist keine Messung, sondern ein Zeitpunkt: Der
      // Container ist im Moment des Messens noch nicht im Layout (der
      // Canvas wird nachgeladen). Konva macht daraus eine Zeichenflaeche
      // ohne Ausdehnung, und der erste drawImage darauf reisst die ganze
      // Seite mit ("InvalidStateError: ... width or height of 0"). Der
      // letzte brauchbare Wert bleibt in dem Fall stehen.
      if (el.clientWidth > 0) setViewportWidth(el.clientWidth)
      setMeasuredHeight(el.clientHeight)
      setWindowHeight(window.innerHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // isFullscreen als Abhängigkeit: der Wechsel ändert die Containergröße,
    // löst aber kein resize-Ereignis aus — ohne erneutes Messen bliebe die
    // Bühne in der alten Größe stehen.
  }, [isFullscreen])

  useEffect(() => {
    return () => {
      if (zoomHintTimeoutRef.current) clearTimeout(zoomHintTimeoutRef.current)
    }
  }, [])

  // Seiten-Scroll sperren, solange Vollbild aktiv ist. Ohne das scrollt die
  // Seite hinter der Überlagerung weiter und man landet beim Verlassen an
  // einer anderen Stelle als vorher.
  useEffect(() => {
    if (!isFullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [isFullscreen])

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    // Plain scrolling must never zoom the canvas — the form sits right below
    // it on the page, so an un-gated wheel handler turns "scroll down to the
    // quick-add bar" into an accidental zoom. Match the Figma/Google-Maps
    // convention: only Strg/Cmd + wheel zooms; a bare wheel is left alone so
    // the browser scrolls the page normally.
    if (!e.evt.ctrlKey && !e.evt.metaKey) {
      setShowZoomHint(true)
      if (zoomHintTimeoutRef.current) clearTimeout(zoomHintTimeoutRef.current)
      zoomHintTimeoutRef.current = setTimeout(() => setShowZoomHint(false), 2000)
      return
    }
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / stageScale,
      y: (pointer.y - stagePos.y) / stageScale,
    }
    const newScale = clampScale(e.evt.deltaY > 0 ? stageScale / 1.08 : stageScale * 1.08)
    setCamera({
      scale: newScale,
      pos: { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale },
    })
  }

  function gapEndpoints(gapIndex: number): { from: Point; to: Point } {
    const from =
      gapIndex === -1 ? supplierRight : boxRightEdge(positions[orderedProcesses[gapIndex].id])
    const to =
      gapIndex === orderedProcesses.length - 1
        ? customerLeft
        : boxLeftEdge(positions[orderedProcesses[gapIndex + 1].id])
    return { from, to }
  }

  // Connections are now graph edges — one inventory_buffers row per
  // connection, using its own from/to (not array-adjacent index math).
  // That's what makes merge/split (multiple edges into/out of one process)
  // render correctly instead of assuming a single strict chain. Anchored to
  // each box's actual right/left edge (vertically centered) — not its raw
  // x/y (top-left corner), which used to let the connection point land
  // inside the box instead of at its boundary.
  const edges = useMemo(() => {
    return buffers
      .map((buffer) => {
        const fromBoxPos = buffer.from_process_id ? positions[buffer.from_process_id] : undefined
        const toBoxPos = buffer.to_process_id ? positions[buffer.to_process_id] : undefined
        return {
          buffer,
          fromPos: buffer.from_process_id ? (fromBoxPos ? boxRightEdge(fromBoxPos) : undefined) : supplierRight,
          toPos: buffer.to_process_id ? (toBoxPos ? boxLeftEdge(toBoxPos) : undefined) : customerLeft,
        }
      })
      .filter((e): e is { buffer: Buffer; fromPos: Point; toPos: Point } => !!e.fromPos && !!e.toPos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffers, positions])

  // Material-flow segments: each edge is split around its WIP triangle so
  // the arrow visibly ends/restarts there instead of running through the
  // symbol. Boundary edges (supplier/customer) are heavier "shipment"
  // block arrows; a supermarket's withdrawal side becomes a pull loop;
  // everything else is a plain "push" arrow — unless the user explicitly
  // overrides the style, which then applies to the whole connection.
  // A 'continuous' buffer (one-piece flow) has no WIP triangle to leave a
  // gap for, so it renders as one unbroken line straight from box to box.
  const materialSegments = useMemo(() => {
    const segments: {
      points: [number, number, number, number]
      kind: 'shipment' | 'push' | 'pull' | 'continuous'
      kanbanType?: string | null
      // Only set for 'continuous' segments — there's no BufferMarker sitting
      // on top of them to click, so the line itself needs to carry enough
      // to open the BufferEditPanel (see the click handler at render time).
      fromId?: string | null
      toId?: string | null
    }[] = []
    for (const { buffer, fromPos, toPos } of edges) {
      const isEdgeConn = !buffer.from_process_id || !buffer.to_process_id
      const isSupermarket = buffer.buffer_type === 'supermarket'

      if (buffer.buffer_type === 'continuous' && !isEdgeConn) {
        segments.push({
          points: [fromPos.x, fromPos.y, toPos.x, toPos.y],
          kind: 'continuous',
          fromId: buffer.from_process_id,
          toId: buffer.to_process_id,
        })
        continue
      }

      const { near, far } = splitSegmentAroundGap(fromPos, toPos, BUFFER_SIZE / 2 + 6)

      if (buffer.flow_style) {
        const kind = buffer.flow_style as 'push' | 'pull' | 'shipment'
        segments.push({ points: [fromPos.x, fromPos.y, near.x, near.y], kind, kanbanType: buffer.kanban_type })
        segments.push({ points: [far.x, far.y, toPos.x, toPos.y], kind, kanbanType: buffer.kanban_type })
        continue
      }

      const inKind: 'shipment' | 'push' = isEdgeConn ? 'shipment' : 'push'
      const outKind: 'shipment' | 'push' | 'pull' = isEdgeConn ? 'shipment' : isSupermarket ? 'pull' : 'push'
      segments.push({ points: [fromPos.x, fromPos.y, near.x, near.y], kind: inKind })
      segments.push({ points: [far.x, far.y, toPos.x, toPos.y], kind: outKind, kanbanType: buffer.kanban_type })
    }
    return segments
  }, [edges])

  const ladderSegments = useMemo(() => {
    if (orderedProcesses.length === 0) return []
    const segments: { x1: number; x2: number; y: number; label: string; kind: 'wait' | 'process' }[] = []

    for (const g of bufferGapIndices(orderedProcesses.length)) {
      const { from, to } = gapEndpoints(g)
      const fromId = g === -1 ? null : orderedProcesses[g].id
      const toId = g === orderedProcesses.length - 1 ? null : orderedProcesses[g + 1].id
      const buffer = findBuffer(buffers, fromId, toId)
      const days = buffer && kpis.departureRatePerDay ? buffer.wip_count / kpis.departureRatePerDay : null
      segments.push({
        x1: from.x,
        x2: to.x,
        y: ladderHighY,
        label:
          days !== null
            ? `${days.toFixed(1)} ${tCanvas('daysUnit')}`
            : buffer
              ? `${buffer.wip_count} ${tCanvas('piecesUnit')}`
              : '0',
        kind: 'wait',
      })

      if (g < orderedProcesses.length - 1) {
        const process = orderedProcesses[g + 1]
        const pos = positions[process.id]
        segments.push({
          x1: pos.x,
          x2: pos.x + PROCESS_WIDTH,
          y: ladderLowY,
          label: `${process.cycle_time} ${tCanvas('minUnit')}`,
          kind: 'process',
        })
      }
    }
    return segments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedProcesses, buffers, positions, kpis.departureRatePerDay, ladderHighY, ladderLowY])

  const ladderPoints = ladderSegments.flatMap((s) => [s.x1, s.y, s.x2, s.y])
  const ladderEndX = ladderSegments.length > 0 ? ladderSegments[ladderSegments.length - 1].x2 : 0

  const selectedProcess =
    selection?.kind === 'process' ? (processes.find((p) => p.id === selection.id) ?? null) : null
  const selectedIndex = selectedProcess ? orderedProcesses.indexOf(selectedProcess) : -1
  const prevProcessId = selectedIndex > 0 ? orderedProcesses[selectedIndex - 1].id : null
  const nextProcessId =
    selectedIndex >= 0 && selectedIndex < orderedProcesses.length - 1
      ? orderedProcesses[selectedIndex + 1].id
      : null
  const selectedBeforeWip = selectedProcess
    ? (findBuffer(buffers, prevProcessId, selectedProcess.id)?.wip_count ?? 0)
    : 0
  const selectedAfterWip = selectedProcess
    ? (findBuffer(buffers, selectedProcess.id, nextProcessId)?.wip_count ?? 0)
    : 0

  function handleQuickAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = quickAddName.trim()
    const cycleTime = Number(quickAddCt)

    if (!name || Number.isNaN(cycleTime)) {
      setError(t('errorNameAndCycleTime'))
      return
    }

    setError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.addProcess(s, { name, cycleTime }))
        setQuickAddName('')
        setQuickAddCt('')
        nameInputRef.current?.focus()
        return
      }
    startTransition(async () => {
      try {
        await addProcess(project.id, scenarioId, { name, cycleTime })
        setQuickAddName('')
        setQuickAddCt('')
        router.refresh()
        nameInputRef.current?.focus()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorAdding'))
      }
    })
  }

  function handleThroughputBlur() {
    setError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.updateAnnualThroughput(s, liveAnnualThroughput ?? null))
        return
      }
    startTransition(async () => {
      try {
        await updateAnnualThroughput(project.id, liveAnnualThroughput)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSaving'))
      }
    })
  }

  function handleAvailableMinutesBlur() {
    if (liveAvailableMinutes === undefined) return // invalid/blank input — leave the stored value untouched
    setError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.updateAvailableMinutes(s, liveAvailableMinutes))
        return
      }
    startTransition(async () => {
      try {
        await updateAvailableMinutes(project.id, liveAvailableMinutes)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSaving'))
      }
    })
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setError(null)
      startTransition(async () => {
        try {
          await importProcessesCsv(project.id, scenarioId, text)
          router.refresh()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'CSV-Import fehlgeschlagen.')
        }
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Reordering/lanes are click-driven now (buttons in ProcessEditPanel),
  // not freeform dragging — see handleMoveInSequence/handleChangeLane below.
  function handleMoveInSequence(processId: string, direction: 'earlier' | 'later') {
    const newOrder = moveInOrder(chainOrder, processId, direction)
    if (newOrder === chainOrder) return // already at that end, nothing to do

    setError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.reorderProcesses(s, newOrder))
        return
      }
    startTransition(async () => {
      try {
        await reorderProcesses(project.id, scenarioId, newOrder)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorReorder'))
      }
    })
  }

  function handleChangeLane(processId: string, lane: number) {
    setError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.updateProcessLane(s, processId, Math.max(0, lane)))
        return
      }
    startTransition(async () => {
      try {
        await updateProcessLane(project.id, processId, Math.max(0, lane))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorLane'))
      }
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* [UX-Audit 2026-08-16, P2] Am Telefon standen Eingaben,
          Methodikpruefung und die fuenf Kennzahlenkacheln vor der
          Zeichenflaeche — 880 px Inhalt, bevor das Arbeitsobjekt ueberhaupt
          sichtbar wird. Die Quellreihenfolge bleibt (Kontext vor Diagramm ist
          die sinnvolle Lesereihenfolge fuer eine Vorleseansicht); `order`
          dreht nur die *Anzeige* unter `lg` um. */}
      <div className="flex flex-col">
        <div className="order-3 lg:order-1">
        {/* Customer demand + available production time — the two inputs that
            drive lead time / takt live. PLT = WIP / Exitrate (Little's Law):
            Exitrate is derived from Jahresbedarf, so changing Jahresbedarf
            deliberately changes PLT — that's the formula working correctly,
            not a bug. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="throughput" className="text-sm text-zinc-600">
              {t('annualDemandLabel')}
            </label>
            <input
              id="throughput"
              type="number"
              min={0}
              value={throughputInput}
              onChange={(e) => setThroughputInput(e.target.value)}
              onBlur={handleThroughputBlur}
              placeholder={t('annualDemandPlaceholder')}
              className="w-32 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="available-minutes" className="text-sm text-zinc-600">
              <TermTooltip term="availableMinutesPerDay">{t('availableMinutesLabel')}</TermTooltip>
            </label>
            <input
              id="available-minutes"
              type="number"
              min={1}
              value={availableMinutesInput}
              onChange={(e) => setAvailableMinutesInput(e.target.value)}
              onBlur={handleAvailableMinutesBlur}
              placeholder={t('availableMinutesPlaceholder')}
              className="w-24 rounded-control border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Die drei Befunde standen frueher als drei gleich grosse Banner
            untereinander und unterschieden sich nur in Bernstein oder Rot — man
            sah nicht, was zuerst zaehlt, und bei dreien rutschte die
            Zeichenflaeche spuerbar nach unten. Die Rangfolge steckt jetzt in
            `severity`: `critical` heisst, dass eine oben angezeigte Kennzahl
            dadurch ihre Aussagekraft verliert. */}
        <MethodCheckPanel findings={methodFindings} />
        </div>

        {/* [UX-Audit 2026-08-16, P2] Dieselben fuenf Werte wie in den Kacheln
            oben, hier als reine Zahlen ohne Kachelrahmen — "die fuenf Kacheln
            sind am Telefon reine Flaeche". Zwei Zeilen durch drei Spalten bei
            fuenf Eintraegen. Nur unter `lg`: dort ersetzt sie die Kacheln,
            die im Diagramm-Block selbst ab `lg` erst erscheinen. */}
        <div className="order-2 grid grid-cols-3 gap-x-3 gap-y-3 py-3 lg:hidden">
          {fullscreenKpis.map((kpi) => (
            <div key={kpi.label} className="min-w-0">
              <div className="truncate text-xs text-zinc-500">{kpi.label}</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-base font-semibold tabular-nums text-zinc-950">
                  {kpi.value}
                </span>
                {kpi.value !== KPI_EMPTY && (
                  <span className="text-xs text-zinc-500">{kpi.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="order-1 lg:order-2">
          {/* Kennzahlenleiste und Zeichenflaeche in einem Rahmen: Eine klebende
              Leiste haelt nur, solange ihr umschliessender Block im Bild ist.
              Ohne diesen Rahmen blieben die Kennzahlen auch dann noch oben
              stehen, wenn man laengst beim Austaktungsdiagramm liest — 271 px
              Zahlen, auf die gerade niemand schaut. So loest sie sich genau dann,
              wenn das Diagramm den Bildschirm verlaesst. */}
          <div>
        {/* [Design-Audit 2026-08-31, Befund 06] Die Kennzahlen standen ueber
            dem Diagramm und scrollten mit ihm weg: Wer eine Zykluszeit aenderte,
            sah nie gleichzeitig den Prozess und die Zahl, die sich dadurch
            aendert. "Live berechnen" stimmte technisch und war nicht
            wahrnehmbar. Kennzahlen und Werkzeugleiste bleiben jetzt zusammen
            oben stehen, solange man am Diagramm arbeitet.

            Erst ab `lg` — auf einem Telefon waeren 180 px klebende Leiste die
            Haelfte des Bildes, und dort scrollt man ohnehin ein Stueck nach dem
            anderen statt beides nebeneinander zu halten. */}
        <div className="bg-zinc-50 lg:sticky lg:top-0 lg:z-20 lg:pt-4">
          {/* Live KPI bar — ab lg; darunter zeigt die kompakte Telefon-
              Kennzahlenzeile weiter oben dieselben Werte (Befund P2). */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-5">
            <KpiTile
              label={<TermTooltip term="cycleTimeSum">{t('kpiCycleTimeSum')}</TermTooltip>}
              value={kpis.totalCycleTimeMinutes.toFixed(1)}
              unit={t('unitMin')}
            />
            <KpiTile
              label={<TermTooltip term="leadTime">{t('kpiLeadTime')}</TermTooltip>}
              value={kpis.totalLeadTimeDays !== null ? kpis.totalLeadTimeDays.toFixed(1) : KPI_EMPTY}
              unit={t('unitDays')}
              formula={leadTimeFormula}
            />
            <KpiTile
              label={<TermTooltip term="pce">{t('kpiPce')}</TermTooltip>}
              tier={ratePce(kpis.valueAddedRatioPercent)}
              value={
                kpis.valueAddedRatioPercent !== null
                  ? kpis.valueAddedRatioPercent.toFixed(2)
                  : KPI_EMPTY
              }
              unit={t('unitPercent')}
            />
            <KpiTile
              label={<TermTooltip term="taktTime">{t('kpiTaktTime')}</TermTooltip>}
              value={kpis.taktTimeMinutes !== null ? kpis.taktTimeMinutes.toFixed(1) : KPI_EMPTY}
              unit={t('unitMin')}
              formula={taktTimeFormula}
            />
            <KpiTile
              label={<TermTooltip term="exitRate">{t('kpiExitRate')}</TermTooltip>}
              value={kpis.exitRatePerDay !== null ? kpis.exitRatePerDay.toFixed(1) : KPI_EMPTY}
              unit={t('unitPiecesPerDay')}
              formula={exitRateFormula}
              tier={rateCapacityCoverage(kpis.capacityCoverage)}
            />
          </div>

          {/* Zoom controls — the stage auto-fits on load and whenever the
              diagram grows; this is just for manual override. Wheel-zoom needs
              Strg/Cmd (see handleWheel) so a normal scroll down to the toolbar
              below never zooms the canvas by accident. */}
          {/* [UX-Audit 2026-08-16, P1] Die Leiste bleibt beim Scrollen stehen.
              Vorher scrollten Zoom und Einpassen mit der Seite weg — also genau
              dann ausser Sicht, wenn man sie braucht, weil man sich verschoben
              hat. Das war die Hauptursache fuer "man verscrollt sich schnell":
              drei Bewegungsraeume (Seite, Diagramm, Zoom) ohne einen einzigen
              festen Bezugspunkt. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 py-3">
            {/* Der Hinweis gilt nur für Maus und Trackpad — auf dem Telefon ist er
                nicht nur nutzlos, er drängt auch die Knöpfe daneben aus dem Bild. */}
            <p
              className={`hidden text-xs text-zinc-500 transition-opacity duration-300 sm:block ${
                showZoomHint ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Strg/Cmd + Mausrad zum Zoomen
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf || processes.length === 0}
                className={primaryButtonClass}
              >
                {isExportingPdf ? t('exportingPdf') : t('exportPdf')}
              </button>
              {/* Phase 7b: Präsentationsmodus — blendet CSV-Import und
                  Lieferant/Kunde/ERP-Label-Bearbeitung aus (Nebensächliches für
                  eine laufende Moderation), Prozess-/Puffer-Boxen bleiben
                  editierbar. */}
              {/* [UX-Audit 2026-08-16, P3] Einstieg in den Vollbildmodus. */}
              <button type="button" onClick={() => setIsFullscreen(true)} className={secondaryButtonClass}>
                {t('fullscreen')}
              </button>
              {/* [Design-Audit 2026-08-31, Befund 08] Der aktive Zustand war hier
                  von Hand geschrieben (`px-4 py-3`, ohne Rahmen) und damit 2 px
                  flacher und 6 px schmaler als der inaktive Sekundaerknopf. Der
                  Knopf wuchs beim Klicken und schob die Knoepfe daneben weiter —
                  genau in dem Moment, in dem ein Moderator vor Publikum
                  umschaltet. Beide Zustaende teilen jetzt dieselbe Groesse aus
                  `ui/buttons`; es aendert sich nur die Farbe.

                  Das Haekchen bleibt im Aus-Zustand als `invisible` stehen,
                  statt zu verschwinden: Es ist der Zustandshinweis fuer alle, die
                  die Farbe nicht unterscheiden, und weil es dort Platz belegt,
                  aendert auch die Beschriftung die Breite nicht mehr. */}
              <button
                type="button"
                onClick={() => setPresentationMode((prev) => !prev)}
                aria-pressed={presentationMode}
                className={presentationMode ? primaryButtonClass : secondaryButtonClass}
              >
                <span aria-hidden className={presentationMode ? undefined : 'invisible'}>
                  ✓{' '}
                </span>
                {t('presentationMode')}
              </button>
              {/* UX-Audit Phase 7a finding #1 (touch targets): these three
                  buttons measured ~28-30px tall (py-1/text-sm); bumped to py-3
                  (~44px) — the row facilitators reach for most often when
                  driving a workshop from a laptop trackpad. */}
              <div className="flex items-center gap-0.5 rounded-control border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setCamera({ scale: clampScale(stageScale / 1.2), pos: stagePos })}
                  className="rounded-control px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  aria-label={t('zoomOut')}
                >
                  −
                </button>
                <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-zinc-500">
                  {Math.round(stageScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setCamera({ scale: clampScale(stageScale * 1.2), pos: stagePos })}
                  className="rounded-control px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  aria-label={t('zoomIn')}
                >
                  +
                </button>
                {/* [UX-Audit 2026-08-16, P5] "Einpassen" stand hier ein zweites
                    Mal, seit es zusätzlich auf der Zeichenfläche schwebt. Der
                    schwebende bleibt: er sitzt dort, wo gearbeitet wird, und
                    zeigt zusätzlich an, ob die Ansicht überhaupt verschoben ist. */}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas — standard VSM black-and-white line art on a white ground.
            Information flow (dashed/zigzag, ERP) above the process row,
            material flow (solid/block arrows) at the row, Zeitleiter below. */}
        <div
          ref={stageContainerRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 overflow-hidden bg-white'
              : 'relative mt-2 overflow-hidden rounded-surface border border-zinc-200'
          }
          // [Live-Test 2026-08-16, Smartphone] Die Stage steht auf `draggable`,
          // und Konva greift damit auch Wischgesten mit dem Finger ab: wer den
          // Finger auf dem Diagramm hatte und nach unten wischte, verschob das
          // Diagramm statt die Seite zu scrollen — und kam an die Bedienelemente
          // darunter nicht mehr heran.
          //
          // `pan-y` gibt das vertikale Wischen an den Browser zurück (Konva sieht
          // die Geste dann gar nicht mehr), waagrechtes Ziehen verschiebt weiter
          // die Ansicht. `pinch-zoom` bleibt erlaubt, sonst liesse sich auf dem
          // Telefon gar nicht mehr heranzoomen — die +/−-Knöpfe sind dafür zu
          // klein zum Zielen.
          style={{ touchAction: 'pan-y pinch-zoom' }}
        >
          {/* Zweiter Weg zurück zur Gesamtansicht, direkt auf der Zeichenfläche.
              Der gleichnamige Knopf in der Leiste oben bleibt, ist aber genau
              dann schwer zu finden, wenn man ihn braucht: nach einem
              versehentlichen Verschieben sucht man ihn zwischen "PDF
              exportieren" und "Präsentationsmodus", auf schmalen Bildschirmen
              zusätzlich nach einem Zeilenumbruch. */}
          {/* [UX-Audit 2026-08-16, P4] Der Knopf beantwortet die Frage "bin ich
              verschoben?", bevor sie gestellt wird: `camera` ist null, solange
              die Ansicht automatisch eingepasst ist, und gesetzt, sobald von
              Hand gezoomt oder geschoben wurde. Nur im zweiten Fall tritt er
              hervor — sonst wäre es ein Dauerreiz ohne Aussage. */}
          {/* Im Vollbild liegt die fixierte Leiste hinter der Überlagerung.
              Zoom und Ausstieg müssen deshalb hier noch einmal erreichbar sein,
              sonst wäre der Modus eine Falle. */}
          {isFullscreen && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-control border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setCamera({ scale: clampScale(stageScale / 1.2), pos: stagePos })}
                className="rounded-control px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                aria-label={t('zoomOut')}
              >
                −
              </button>
              <span className="min-w-[3rem] text-center text-xs tabular-nums text-zinc-500">
                {Math.round(stageScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setCamera({ scale: clampScale(stageScale * 1.2), pos: stagePos })}
                className="rounded-control px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                aria-label={t('zoomIn')}
              >
                +
              </button>
              <div className="mx-1 h-4 w-px bg-zinc-200" />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="rounded-control px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t('close')}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleFitToView}
            aria-label={camera ? t('fitViewShifted') : t('fitView')}
            className={
              camera
                ? 'absolute right-3 top-3 z-10 rounded-control bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-700'
                : 'absolute right-3 top-3 z-10 rounded-control border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-500 shadow-sm backdrop-blur hover:bg-white hover:text-zinc-900'
            }
          >
            {t('fitViewLabel')}
          </button>
          <Stage
            ref={stageRef}
            width={viewportWidth}
            // Im Vollbild gibt der Bildschirm die Höhe vor (abzüglich der
            // Kennzahlenleiste), sonst die Höhe des Diagramminhalts.
            // measuredHeight ist beim ersten Bild nach dem Umschalten noch 0 —
            // dann greift der bisherige Wert weiter, siehe stageHeight.
            height={stageHeight}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            // Process boxes are click-only now (no drag), so the Stage can be
            // simply draggable throughout — there's no child drag target left
            // to conflict with.
            draggable
            onWheel={handleWheel}
            onDragEnd={(e) => setCamera({ scale: stageScale, pos: { x: e.target.x(), y: e.target.y() } })}
          >
            <Layer>
              <Rect name="canvas-background" x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#ffffff" />

              {/* Information flow: electronic (zigzag) for customer/ERP/supplier,
                  manual (straight) for ERP -> each process dispatch. */}
              <ErpBox
                x={erpPos.x}
                y={erpPos.y}
                label={project.erp_label}
                isSelected={selection?.kind === 'anchor' && selection.anchor === 'erp'}
                onSelect={() =>
                  setSelection((c) => (c?.kind === 'anchor' && c.anchor === 'erp' ? null : { kind: 'anchor', anchor: 'erp' }))
                }
              />
              {/* [Future-State-Wizard, Frage 6] Heijunka gehoert methodisch an
                  den Steuerungspunkt, nicht an den Schrittmacher-Prozess
                  selbst — deshalb neben dem ERP-Kasten statt am (beweglichen)
                  Prozess. Nur sichtbar, wenn der Schrittmacher sie im Wizard
                  gesetzt hat; ein Projekt ohne Schrittmacher hat auch keine
                  Heijunka-Box. */}
              {pacemaker?.has_heijunka && (
                <HeijunkaBox x={heijunkaPos.x} y={heijunkaPos.y} pitchMinutes={project.pitch_minutes} />
              )}
              <Arrow
                points={zigzagPoints(
                  customerLeft,
                  { x: erpPos.x + ERP_WIDTH, y: erpPos.y + ERP_HEIGHT / 2 },
                  8
                )}
                stroke={INK}
                fill={INK}
                strokeWidth={1}
                pointerLength={6}
                pointerWidth={6}
              />
              <Arrow
                points={zigzagPoints(
                  { x: erpPos.x, y: erpPos.y + ERP_HEIGHT / 2 },
                  supplierRight,
                  8
                )}
                stroke={INK}
                fill={INK}
                strokeWidth={1}
                pointerLength={6}
                pointerWidth={6}
              />
              {dispatchProcesses.map((process) => {
                const pos = positions[process.id]
                if (!pos) return null
                return (
                  <Arrow
                    key={`info-${process.id}`}
                    points={[
                      erpPos.x + ERP_WIDTH / 2,
                      erpPos.y + ERP_HEIGHT,
                      pos.x + PROCESS_WIDTH / 2,
                      pos.y,
                    ]}
                    stroke={INK}
                    fill={INK}
                    strokeWidth={1}
                    pointerLength={6}
                    pointerWidth={6}
                  />
                )
              })}

              {/* Material flow */}
              <CloudShape
                x={supplierPos.x}
                y={supplierPos.y}
                label={project.supplier_name}
                isSelected={selection?.kind === 'anchor' && selection.anchor === 'supplier'}
                onSelect={() =>
                  setSelection((c) =>
                    c?.kind === 'anchor' && c.anchor === 'supplier' ? null : { kind: 'anchor', anchor: 'supplier' }
                  )
                }
              />

              {materialSegments.map((seg, i) => {
                if (seg.kind === 'shipment') return <ShipmentArrow key={i} points={seg.points} />
                if (seg.kind === 'pull') return <PullArrow key={i} points={seg.points} kanbanType={seg.kanbanType} />
                // 'continuous' (one-piece flow) uses the same plain arrow as
                // 'push' — the only difference is that it was never split
                // around a WIP triangle above, so it's a single unbroken line.
                // With no BufferMarker sitting on it to click, the line itself
                // opens the BufferEditPanel (widened via hitStrokeWidth so it's
                // easy to hit precisely).
                const isContinuous = seg.kind === 'continuous'
                const isSelected =
                  isContinuous &&
                  selection?.kind === 'buffer' &&
                  selection.from === seg.fromId &&
                  selection.to === seg.toId
                return (
                  <Arrow
                    key={i}
                    points={seg.points}
                    stroke={isSelected ? ACCENT : INK}
                    fill={isSelected ? ACCENT : INK}
                    strokeWidth={2}
                    pointerLength={9}
                    pointerWidth={9}
                    hitStrokeWidth={isContinuous ? 16 : undefined}
                    onClick={
                      isContinuous
                        ? () =>
                            setSelection((current) =>
                              current?.kind === 'buffer' && current.from === seg.fromId && current.to === seg.toId
                                ? null
                                : { kind: 'buffer', from: seg.fromId ?? null, to: seg.toId ?? null }
                            )
                        : undefined
                    }
                    onTap={
                      isContinuous
                        ? () =>
                            setSelection((current) =>
                              current?.kind === 'buffer' && current.from === seg.fromId && current.to === seg.toId
                                ? null
                                : { kind: 'buffer', from: seg.fromId ?? null, to: seg.toId ?? null }
                            )
                        : undefined
                    }
                    onMouseEnter={
                      isContinuous
                        ? (e) => {
                            const stage = e.target.getStage()
                            if (stage) stage.container().style.cursor = 'pointer'
                          }
                        : undefined
                    }
                    onMouseLeave={
                      isContinuous
                        ? (e) => {
                            const stage = e.target.getStage()
                            if (stage) stage.container().style.cursor = 'default'
                          }
                        : undefined
                    }
                  />
                )
              })}

              {processes.map((process) => {
                const pos = positions[process.id]
                if (!pos) return null
                const { isBottleneck } = checkCapacity(
                  { cycleTime: process.cycle_time, oee: process.oee, operatorCount: process.operator_count },
                  kpis.taktTimeMinutes
                )
                return (
                  <ProcessBox
                    key={process.id}
                    process={process}
                    x={pos.x}
                    y={pos.y}
                    isSelected={selection?.kind === 'process' && selection.id === process.id}
                    isBottleneck={isBottleneck}
                    counterScale={1 / stageScale}
                    onSelect={() =>
                      setSelection((current) =>
                        current?.kind === 'process' && current.id === process.id
                          ? null
                          : { kind: 'process', id: process.id }
                      )
                    }
                  />
                )
              })}

              {/* Buffer markers paint last (on top of both arrows and process
                  boxes) so the WIP triangle/icon is never hidden — it used to
                  be able to land under a box due to a since-fixed anchor bug,
                  this ordering is defense-in-depth against any future overlap.
                  A 'continuous' (one-piece flow) buffer has no symbol at all —
                  that's the whole point, a direct line with nothing sitting
                  on it — so it's skipped here entirely, not just left blank. */}
              {edges.map(({ buffer, fromPos, toPos }) => {
                if (buffer.buffer_type === 'continuous') return null
                const mid = midpoint(fromPos, toPos)
                const fromId = buffer.from_process_id
                const toId = buffer.to_process_id
                const isSelected = selection?.kind === 'buffer' && selection.from === fromId && selection.to === toId
                return (
                  <BufferMarker
                    key={buffer.id}
                    x={mid.x - BUFFER_SIZE / 2}
                    y={mid.y - BUFFER_SIZE / 2}
                    wipCount={buffer.wip_count}
                    bufferType={buffer.buffer_type ?? 'standard'}
                    isSelected={isSelected}
                    onSelect={() =>
                      setSelection((current) =>
                        current?.kind === 'buffer' && current.from === fromId && current.to === toId
                          ? null
                          : { kind: 'buffer', from: fromId, to: toId }
                      )
                    }
                  />
                )
              })}

              <CloudShape
                x={customerPos.x}
                y={customerPos.y}
                label={project.customer_name}
                isSelected={selection?.kind === 'anchor' && selection.anchor === 'customer'}
                onSelect={() =>
                  setSelection((c) =>
                    c?.kind === 'anchor' && c.anchor === 'customer' ? null : { kind: 'anchor', anchor: 'customer' }
                  )
                }
              />

              {/* Zeitleiter (timeline / ladder) */}
              {ladderSegments.length > 0 && (
                <>
                  <Line points={ladderPoints} stroke={INK} strokeWidth={2} />
                  {ladderSegments.map((seg, i) => (
                    <Text
                      key={i}
                      text={seg.label}
                      x={seg.x1}
                      width={seg.x2 - seg.x1}
                      y={seg.kind === 'wait' ? seg.y - 16 : seg.y + 6}
                      align="center"
                      fontSize={CANVAS_TEXT.label}
                      fill={INK}
                    />
                  ))}
                  <LadderSummary
                    x={ladderEndX + 12}
                    yTop={ladderHighY}
                    yBottom={ladderLowY}
                    counterScale={1 / stageScale}
                    leadTimeDays={kpis.totalLeadTimeDays}
                    valueAddMinutes={kpis.totalCycleTimeMinutes}
                  />
                </>
              )}
            </Layer>
          </Stage>

          {/* Im Vollbild waren die Kennzahlen bisher gar nicht erreichbar: Sie
              stehen im Seitenfluss oberhalb der Zeichenfläche, und der Modus
              überdeckt die ganze Seite. Wer also im Workshop eine Zykluszeit
              änderte, musste das Vollbild verlassen, um die Wirkung zu sehen.
              Genau die Bewegung, die das Werkzeug überflüssig machen soll. */}
          {isFullscreen && (
            <div
              className="absolute inset-x-0 bottom-0 flex items-stretch gap-px overflow-x-auto border-t border-zinc-200 bg-zinc-100"
              style={{ height: FULLSCREEN_KPI_BAR_HEIGHT }}
            >
              {fullscreenKpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="flex min-w-[9.5rem] flex-1 flex-col justify-center bg-white px-5"
                >
                  <span className="text-xs font-medium text-zinc-600">{kpi.label}</span>
                  <span className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">
                      {kpi.value}
                    </span>
                    {kpi.value !== KPI_EMPTY && (
                      <span className="text-xs font-medium text-zinc-500">{kpi.unit}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
      </div>

      {processes.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500">
          {t('noProcessesYet')}
        </p>
      )}

      {selectedProcess && (
        <ProcessEditPanel
          key={selectedProcess.id}
          projectId={project.id}
          scenarioId={scenarioId}
          process={selectedProcess}
          allProcesses={processes}
          buffers={buffers}
          beforeWip={selectedBeforeWip}
          afterWip={selectedAfterWip}
          prevProcessId={prevProcessId}
          nextProcessId={nextProcessId}
          canMoveEarlier={selectedIndex > 0}
          canMoveLater={selectedIndex >= 0 && selectedIndex < orderedProcesses.length - 1}
          onMoveInSequence={(direction) => handleMoveInSequence(selectedProcess.id, direction)}
          onChangeLane={(lane) => handleChangeLane(selectedProcess.id, lane)}
          onClose={() => setSelection(null)}
        />
      )}

      {selection?.kind === 'buffer' && (
        <BufferEditPanel
          key={`${selection.from}-${selection.to}`}
          projectId={project.id}
          scenarioId={scenarioId}
          fromProcessId={selection.from}
          toProcessId={selection.to}
          currentWip={findBuffer(buffers, selection.from, selection.to)?.wip_count ?? 0}
          currentBufferType={findBuffer(buffers, selection.from, selection.to)?.buffer_type ?? 'standard'}
          currentFlowStyle={findBuffer(buffers, selection.from, selection.to)?.flow_style ?? ''}
          currentKanbanType={findBuffer(buffers, selection.from, selection.to)?.kanban_type ?? ''}
          onClose={() => setSelection(null)}
        />
      )}

      {selection?.kind === 'anchor' && !presentationMode && (
        <AnchorEditPanel
          key={selection.anchor}
          projectId={project.id}
          anchor={selection.anchor}
          currentLabel={
            selection.anchor === 'supplier'
              ? project.supplier_name
              : selection.anchor === 'customer'
                ? project.customer_name
                : project.erp_label
          }
          onClose={() => setSelection(null)}
        />
      )}

      {/* [Design-Audit 2026-08-31, Befund 06] Austaktung und Benchmark standen
          beide im Stapel unter dem Diagramm. Wer den Branchenvergleich lesen
          wollte, scrollte an der Austaktung vorbei, und das Diagramm war
          laengst aus dem Bild — die Seite wurde immer laenger, statt eine
          Frage nach der anderen zu beantworten.

          Beide beziehen sich auf dieselben Stationen und beantworten je eine
          Frage: "welche Station sprengt den Takt" gegen "wo stehen wir im
          Vergleich". Immer nur eine davon ist zu sehen; der Reiter sagt, dass
          es die andere auch gibt. */}
      <div className="mt-6">
        {hasBenchmark && (
          <div role="tablist" aria-label={t('tabsAria')} className="flex gap-6 border-b border-zinc-200">
            {ANALYSIS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`analysis-tab-${tab.id}`}
                aria-selected={analysisTab === tab.id}
                aria-controls="analysis-panel"
                onClick={() => setAnalysisTab(tab.id)}
                className={
                  analysisTab === tab.id
                    ? 'border-b-2 border-brand-600 pb-2.5 pt-1 text-sm font-semibold text-brand-600'
                    : 'border-b-2 border-transparent pb-2.5 pt-1 text-sm font-medium text-zinc-600 hover:text-zinc-950'
                }
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        )}
        <div
          id="analysis-panel"
          role={hasBenchmark ? 'tabpanel' : undefined}
          aria-labelledby={hasBenchmark ? `analysis-tab-${analysisTab}` : undefined}
          className={hasBenchmark ? 'mt-4' : undefined}
        >
          {analysisTab === 'benchmark' && hasBenchmark ? (
            <BenchmarkPanel processes={processes} references={benchmarkReferences} />
          ) : (
            <BalanceChartPanel
              processes={orderedProcesses.map((p) => ({
                id: p.id,
                name: p.name,
                cycleTime: p.cycle_time,
                operatorCount: p.operator_count,
                oee: p.oee,
                wip: p.wip ?? undefined,
              }))}
              taktTimeMinutes={kpis.taktTimeMinutes}
            />
          )}
        </div>
      </div>

      {/* Toolbar: quick-add + CSV import, grouped in one bordered block */}
      <div className="mt-6 rounded-surface border border-zinc-200 p-4">
        <form onSubmit={handleQuickAddSubmit} className="flex flex-wrap items-end gap-3">
          <Field label={t('processNameLabel')} htmlFor="qa-name">
            <input
              id="qa-name"
              ref={nameInputRef}
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder={t('processNamePlaceholder')}
              className="w-40"
            />
          </Field>
          <Field label={<TermTooltip term="processCycleTime">{t('cycleTimeLabel')}</TermTooltip>} htmlFor="qa-ct">
            <input
              id="qa-ct"
              value={quickAddCt}
              onChange={(e) => setQuickAddCt(e.target.value)}
              placeholder={t('cycleTimePlaceholder')}
              className="w-28"
            />
          </Field>
          <button type="submit" className={primaryButtonClass}>
            {t('addProcess')}
          </button>

          {/* CSV-Bulk-Import ist eine Setup-/Admin-Aktion, kein Schritt in
              einer laufenden Moderation — im Präsentationsmodus ausgeblendet
              (Phase 7b). */}
          {!presentationMode && (
            <div className="ml-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                className="hidden"
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className={secondaryButtonClass}>
                {t('importCsv')}
              </button>
              <p className="mt-1 text-xs text-zinc-500">
                {t('csvColumns')}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// Die Werkzeugleiste im Editor ist die Reihe, die ein Moderator im Workshop
// am Trackpad trifft — deshalb durchgaengig die grosse Groesse (44 px). Die
// Formen selbst kommen aus components/ui/buttons, damit es keine zweite
// Quelle fuer dieselbe Knopfhoehe gibt.
const inputClass = `w-full ${inputSm} focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent`
const primaryButtonClass = buttonPrimaryLg
const secondaryButtonClass = buttonSecondaryLg

function Field({ label, htmlFor, children }: { label: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-600">
        {label}
      </label>
      <div className="mt-1 [&>input]:rounded-control [&>input]:border [&>input]:border-zinc-300 [&>input]:px-2 [&>input]:py-1.5 [&>input]:text-sm [&>input]:focus:outline-none [&>input]:focus:ring-2 [&>input]:focus:ring-brand-600">
        {children}
      </div>
    </div>
  )
}

/** Fehlt die Eingabe für eine Kennzahl, steht hier ein Gedankenstrich — und
 *  daneben wäre eine Einheit eine Aussage über nichts. */
const KPI_EMPTY = '–'

function KpiTile({
  label,
  value,
  unit,
  formula,
  tier,
}: {
  label: ReactNode
  /** Nur die Ziffern, ohne Einheit — die steht in `unit`. */
  value: string
  /** Getrennt vom Wert, damit sie kleiner gesetzt werden kann. */
  unit?: string
  formula?: string
  /**
   * Optional verdict. Only the KPIs with a defensible reference get one — see
   * kpiRating.ts. The chip sits under the value rather than beside the label
   * because "Verbesserungsbedarf" does not fit next to it in a five-column row.
   */
  tier?: BenchmarkTier | null
}) {
  return (
    <div className="rounded-surface border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      {/* Diese Zahl ist der Grund, warum jemand das Werkzeug überhaupt öffnet.
          Sie stand vorher in 18px — kleiner als die Dashboard-Überschrift und
          gleich groß wie der Projektname in der Kopfzeile. Die Einheit läuft
          kleiner und gedämpft auf derselben Grundlinie mit, damit die Ziffern
          die Zeile führen und mehrere Kacheln nebeneinander vergleichbar
          bleiben. */}
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">
          {value}
        </span>
        {unit && value !== KPI_EMPTY && (
          <span className="text-sm font-medium text-zinc-500">{unit}</span>
        )}
      </div>
      {tier && (
        <div className="mt-2">
          <TierChip tier={tier} />
        </div>
      )}
      {formula && <div className="mt-1 text-xs tabular-nums text-zinc-600">{formula}</div>}
    </div>
  )
}

function ProcessEditPanel({
  projectId,
  scenarioId,
  process,
  allProcesses,
  buffers,
  beforeWip,
  afterWip,
  prevProcessId,
  nextProcessId,
  canMoveEarlier,
  canMoveLater,
  onMoveInSequence,
  onChangeLane,
  onClose,
}: {
  projectId: string
  scenarioId: string | null
  process: Process
  allProcesses: Process[]
  buffers: Buffer[]
  beforeWip: number
  afterWip: number
  prevProcessId: string | null
  nextProcessId: string | null
  canMoveEarlier: boolean
  canMoveLater: boolean
  onMoveInSequence: (direction: 'earlier' | 'later') => void
  onChangeLane: (lane: number) => void
  onClose: () => void
}) {
  const router = useRouter()
  const demoMutate = useDemoMutate()
  const [, startTransition] = useTransition()
  const [name, setName] = useState(process.name)
  const [cycleTime, setCycleTime] = useState(String(process.cycle_time))
  const [oee, setOee] = useState(String(process.oee))
  const [operatorCount, setOperatorCount] = useState(String(process.operator_count))
  const [changeoverTime, setChangeoverTime] = useState(String(process.changeover_time))
  const t = useTranslations('Editor')
  const tClass = useTranslations('Classification')
  const [isPacemaker, setIsPacemaker] = useState(process.is_pacemaker)
  const [classification, setClassification] = useState(process.classification ?? '')
  // UX-Audit Phase 7a finding #6: deletion used to fire on the first click,
  // no confirm/undo — risky in a workshop where the facilitator is
  // presenting and a stray click lands on this button. Second click within
  // the same focus session is required; losing focus resets the arm state.
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [beforeWipInput, setBeforeWipInput] = useState(String(beforeWip))
  const [afterWipInput, setAfterWipInput] = useState(String(afterWip))

  // Live preview so "warum ändert sich C/T nicht" gets answered right where
  // the user is typing, before they even save: Zykluszeit itself (one
  // operator's own time per unit) never changes with operator count — the
  // *effective* (output) cycle time does, and that's what feeds Bearbeitungszeit/
  // Kapazitäts-Check.
  const liveOperatorCountNum = Number(operatorCount)
  const liveCycleTimeNum = Number(cycleTime)
  const liveEffectiveCycleTime =
    !Number.isNaN(liveCycleTimeNum) && !Number.isNaN(liveOperatorCountNum) && liveOperatorCountNum > 1
      ? effectiveCycleTime({ cycleTime: liveCycleTimeNum, operatorCount: liveOperatorCountNum })
      : null
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Phase 6 (Mehrstrang): every actual buffer row touching this process,
  // not just the primary-sequence predecessor/successor above — a process
  // can have more than one of each once a merge/split connection exists.
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [addPredecessorId, setAddPredecessorId] = useState('')
  const [addSuccessorId, setAddSuccessorId] = useState('')
  const incomingEdges = buffers.filter((b) => b.to_process_id === process.id)
  const outgoingEdges = buffers.filter((b) => b.from_process_id === process.id)
  const graphEdges = buffers.map((b) => ({ from: b.from_process_id, to: b.to_process_id }))

  function processLabel(id: string | null): string {
    if (id === null) return '—'
    return allProcesses.find((p) => p.id === id)?.name ?? '(unbekannt)'
  }

  // Candidates for a new predecessor: any other process not already a
  // direct predecessor, and not one that would close a cycle back to
  // itself (a real value stream is a DAG here, not a loop).
  const predecessorCandidates = allProcesses.filter(
    (p) =>
      p.id !== process.id &&
      !incomingEdges.some((e) => e.from_process_id === p.id) &&
      !wouldCreateCycle(graphEdges, p.id, process.id)
  )
  const successorCandidates = allProcesses.filter(
    (p) =>
      p.id !== process.id &&
      !outgoingEdges.some((e) => e.to_process_id === p.id) &&
      !wouldCreateCycle(graphEdges, process.id, p.id)
  )

  function handleAddPredecessor() {
    if (!addPredecessorId) return
    setConnectionError(null)
      if (demoMutate) {
        demoMutate((s) =>
          demoOperations.setBufferWip(s, {
            fromProcessId: addPredecessorId,
            toProcessId: process.id,
            wipCount: 0,
          })
        )
        setAddPredecessorId('')
        return
      }
    startTransition(async () => {
      try {
        await setBufferWip(projectId, scenarioId, {
          fromProcessId: addPredecessorId,
          toProcessId: process.id,
          wipCount: 0,
        })
        setAddPredecessorId('')
        router.refresh()
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : t('errorConnect'))
      }
    })
  }

  function handleAddSuccessor() {
    if (!addSuccessorId) return
    setConnectionError(null)
      if (demoMutate) {
        demoMutate((s) =>
          demoOperations.setBufferWip(s, {
            fromProcessId: process.id,
            toProcessId: addSuccessorId,
            wipCount: 0,
          })
        )
        setAddSuccessorId('')
        return
      }
    startTransition(async () => {
      try {
        await setBufferWip(projectId, scenarioId, {
          fromProcessId: process.id,
          toProcessId: addSuccessorId,
          wipCount: 0,
        })
        setAddSuccessorId('')
        router.refresh()
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : t('errorConnect'))
      }
    })
  }

  function handleDisconnect(bufferId: string) {
    setConnectionError(null)
      if (demoMutate) {
        demoMutate((s) => demoOperations.deleteBufferConnection(s, bufferId))
        return
      }
    startTransition(async () => {
      try {
        await deleteBufferConnection(projectId, bufferId)
        router.refresh()
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : t('errorDisconnect'))
      }
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const ct = Number(cycleTime)
    const oeeNum = Number(oee)
    const operatorCountNum = Number(operatorCount)
    const changeoverTimeNum = Number(changeoverTime)
    const beforeNum = Number(beforeWipInput)
    const afterNum = Number(afterWipInput)

    if (
      !name.trim() ||
      Number.isNaN(ct) ||
      Number.isNaN(oeeNum) ||
      Number.isNaN(operatorCountNum) ||
      Number.isNaN(changeoverTimeNum) ||
      Number.isNaN(beforeNum) ||
      Number.isNaN(afterNum)
    ) {
      setError(t('errorFields'))
      return
    }

    setError(null)
    setIsSaving(true)
      if (demoMutate) {
        demoMutate((s) => {
          const withProcess = demoOperations.updateProcess(s, process.id, {
            name: name.trim(),
            cycle_time: ct,
            oee: oeeNum,
            operator_count: operatorCountNum,
            changeover_time: changeoverTimeNum,
            is_pacemaker: isPacemaker,
            classification: classification || null,
          })
          const withBefore = demoOperations.setBufferWip(withProcess, {
            fromProcessId: prevProcessId,
            toProcessId: process.id,
            wipCount: beforeNum,
          })
          return demoOperations.setBufferWip(withBefore, {
            fromProcessId: process.id,
            toProcessId: nextProcessId,
            wipCount: afterNum,
          })
        })
        onClose()
        return
      }
    startTransition(async () => {
      try {
        await updateProcess(projectId, process.id, {
          name: name.trim(),
          cycleTime: ct,
          oee: oeeNum,
          operatorCount: operatorCountNum,
          changeoverTime: changeoverTimeNum,
          isPacemaker,
          classification: classification || null,
        })
        await setBufferWip(projectId, scenarioId, {
          fromProcessId: prevProcessId,
          toProcessId: process.id,
          wipCount: beforeNum,
        })
        await setBufferWip(projectId, scenarioId, {
          fromProcessId: process.id,
          toProcessId: nextProcessId,
          wipCount: afterNum,
        })
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSaving'))
        setIsSaving(false)
      }
    })
  }

  function handleDelete() {
    setIsSaving(true)
      if (demoMutate) {
        demoMutate((s) => demoOperations.deleteProcess(s, process.id))
        onClose()
        return
      }
    startTransition(async () => {
      try {
        await deleteProcess(projectId, process.id)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorDelete'))
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 rounded-surface border border-brand-600 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-950">{t('editProcess')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:underline"
        >
          {t('close')}
        </button>
      </div>

      {/* Position: Reihenfolge (←/→) verdrahtet die Puffer-Kette automatisch
          neu; Spur (↑/↓) versetzt die Box auf eine parallele Reihe. Ersetzt
          das frühere freie Ziehen — dadurch keine Überschneidungen mehr. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-control bg-zinc-50 px-3 py-2">
        <span className="text-xs font-medium text-zinc-500">{t('position')}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveInSequence('earlier')}
            disabled={!canMoveEarlier}
            className={secondaryButtonClass}
            aria-label={t('moveEarlier')}
            title={t('moveEarlier')}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onMoveInSequence('later')}
            disabled={!canMoveLater}
            className={secondaryButtonClass}
            aria-label={t('moveLater')}
            title={t('moveLater')}
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeLane(process.lane - 1)}
            disabled={process.lane <= 0}
            className={secondaryButtonClass}
            aria-label={t('laneUpTitle')}
            title="Spur höher"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onChangeLane(process.lane + 1)}
            className={secondaryButtonClass}
            aria-label={t('laneDownTitle')}
            title={t('laneDownTitle')}
          >
            ↓
          </button>
        </div>
        {process.lane > 0 && (
          <span className="text-xs text-zinc-500">Spur {process.lane + 1}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="ep-name" className="block text-xs font-medium text-zinc-600">
            Name
          </label>
          <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-ct" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="processCycleTime">{t('cycleTimeLabel')}</TermTooltip>
          </label>
          <input id="ep-ct" value={cycleTime} onChange={(e) => setCycleTime(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-co" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="changeoverTime">{t('changeoverLabel')}</TermTooltip>
          </label>
          <input
            id="ep-co"
            value={changeoverTime}
            onChange={(e) => setChangeoverTime(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="ep-oee" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="oee">{t('oeeLabel')}</TermTooltip>
          </label>
          <input id="ep-oee" value={oee} onChange={(e) => setOee(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-operators" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="operatorCount">{t('operatorsLabel')}</TermTooltip>
          </label>
          <input
            id="ep-operators"
            value={operatorCount}
            onChange={(e) => setOperatorCount(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
          {liveEffectiveCycleTime !== null && (
            <p className="mt-1 text-xs text-zinc-500">
              eff. Zykluszeit: {liveEffectiveCycleTime.toFixed(1)} min (fliesst in Bearbeitungszeit/Kapazitäts-Check
              ein — die Zykluszeit selbst bleibt unverändert)
            </p>
          )}
        </div>
        <div>
          <label htmlFor="ep-before" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="wip">{t('wipBefore')}</TermTooltip>
          </label>
          <input
            id="ep-before"
            value={beforeWipInput}
            onChange={(e) => setBeforeWipInput(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="ep-after" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="wip">{t('wipAfter')}</TermTooltip>
          </label>
          <input
            id="ep-after"
            value={afterWipInput}
            onChange={(e) => setAfterWipInput(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {/* Mehrstrang (Phase 6): "WIP davor/danach" oben deckt nur die eine
          primäre Vorgänger-/Nachfolger-Verbindung in der Sequenz ab. Diese
          Liste zeigt *alle* tatsächlichen Verbindungen — ein Prozess kann
          mehr als einen Vorgänger (Zusammenführung) oder Nachfolger
          (Aufteilung) haben. */}
      <div className="mt-3 rounded-control bg-zinc-50 px-3 py-2">
        <span className="text-xs font-medium text-zinc-500">{t('connections')}</span>

        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-zinc-600">{t('predecessors')}</div>
            <ul className="mt-1 space-y-1">
              {incomingEdges.map((edge) => (
                <li key={edge.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{processLabel(edge.from_process_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(edge.id)}
                    className="-mx-1 -my-2 px-1 py-2 text-red-700 hover:underline"
                    aria-label={t('disconnectFrom', { name: processLabel(edge.from_process_id) })}
                  >
                    {t('disconnect')}
                  </button>
                </li>
              ))}
              {incomingEdges.length === 0 && <li className="text-xs text-zinc-600">{t('none')}</li>}
            </ul>
            {predecessorCandidates.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <select
                  value={addPredecessorId}
                  onChange={(e) => setAddPredecessorId(e.target.value)}
                  className={`${inputClass} text-xs`}
                >
                  <option value="">{t('choosePredecessor')}</option>
                  {predecessorCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPredecessor}
                  disabled={!addPredecessorId}
                  className={secondaryButtonClass}
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-zinc-600">{t('successors')}</div>
            <ul className="mt-1 space-y-1">
              {outgoingEdges.map((edge) => (
                <li key={edge.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{processLabel(edge.to_process_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(edge.id)}
                    className="-mx-1 -my-2 px-1 py-2 text-red-700 hover:underline"
                    aria-label={t('disconnectTo', { name: processLabel(edge.to_process_id) })}
                  >
                    {t('disconnect')}
                  </button>
                </li>
              ))}
              {outgoingEdges.length === 0 && <li className="text-xs text-zinc-600">{t('none')}</li>}
            </ul>
            {successorCandidates.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <select
                  value={addSuccessorId}
                  onChange={(e) => setAddSuccessorId(e.target.value)}
                  className={`${inputClass} text-xs`}
                >
                  <option value="">{t('chooseSuccessor')}</option>
                  {successorCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSuccessor}
                  disabled={!addSuccessorId}
                  className={secondaryButtonClass}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {connectionError && (
          <p className="mt-2 text-xs text-red-700">{connectionError}</p>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor="ep-classification" className="block text-xs font-medium text-zinc-600">
          {t('classificationLabel')}
        </label>
        <select
          id="ep-classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className={`mt-1 ${inputClass} w-56`}
        >
          <option value="">{t('classificationNone')}</option>
          {(Object.keys(CLASSIFICATION) as ClassificationValue[]).map((key) => (
            <option key={key} value={key}>
              {tClass(CLASSIFICATION[key].labelKey)}
            </option>
          ))}
        </select>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-600">
        <input type="checkbox" checked={isPacemaker} onChange={(e) => setIsPacemaker(e.target.checked)} />
        <TermTooltip term="pacemaker">{t('pacemakerProcess')}</TermTooltip>
        {t('pacemakerHint')}
      </label>

      {error && (
        <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          {t('save')}
        </button>
        <button
          type="button"
          onClick={() => (confirmDelete ? handleDelete() : setConfirmDelete(true))}
          onBlur={() => setConfirmDelete(false)}
          disabled={isSaving}
          className={
            confirmDelete
              ? 'rounded-control border border-red-600 bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
              : 'rounded-control border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
          }
        >
          {confirmDelete ? t('confirmDelete') : t('deleteProcess')}
        </button>
      </div>
    </form>
  )
}

function BufferEditPanel({
  projectId,
  scenarioId,
  fromProcessId,
  toProcessId,
  currentWip,
  currentBufferType,
  currentFlowStyle,
  currentKanbanType,
  onClose,
}: {
  projectId: string
  scenarioId: string | null
  fromProcessId: string | null
  toProcessId: string | null
  currentWip: number
  currentBufferType: string
  currentFlowStyle: string
  currentKanbanType: string
  onClose: () => void
}) {
  const router = useRouter()
  const demoMutate = useDemoMutate()
  const [, startTransition] = useTransition()
  const t = useTranslations('Editor')
  const [value, setValue] = useState(String(currentWip))
  const [bufferType, setBufferType] = useState(currentBufferType)
  const [flowStyle, setFlowStyle] = useState(currentFlowStyle)
  const [kanbanType, setKanbanType] = useState(currentKanbanType)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (Number.isNaN(n) || n < 0) {
      setError(t('errorNumber'))
      return
    }
    setError(null)
    setIsSaving(true)
      if (demoMutate) {
        demoMutate((s) =>
          demoOperations.setBufferWip(s, {
            fromProcessId,
            toProcessId,
            wipCount: n,
            bufferType,
            flowStyle: flowStyle || null,
            kanbanType: kanbanType || null,
          })
        )
        onClose()
        return
      }
    startTransition(async () => {
      try {
        await setBufferWip(projectId, scenarioId, {
          fromProcessId,
          toProcessId,
          wipCount: n,
          bufferType,
          flowStyle: flowStyle || null,
          kanbanType: kanbanType || null,
        })
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSaving'))
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-surface border border-brand-600 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-950">
        <TermTooltip term="wip">{t('wipLabel')}</TermTooltip>
      </h2>
      <div>
        <label htmlFor="buf-wip" className="block text-xs font-medium text-zinc-600">
          {t('unitPieces')}
        </label>
        <input id="buf-wip" value={value} onChange={(e) => setValue(e.target.value)} className={`mt-1 ${inputClass} w-28`} />
      </div>
      <div>
        <label htmlFor="buf-type" className="block text-xs font-medium text-zinc-600">
          <TermTooltip term="bufferType">{t('bufferTypeLabel')}</TermTooltip>
        </label>
        <select
          id="buf-type"
          value={bufferType}
          onChange={(e) => {
            const next = e.target.value
            setBufferType(next)
            // Kanban icon variant only makes sense on a supermarket's pull
            // arrow — drop it immediately when switching away so a stale
            // choice doesn't silently linger until save.
            if (next !== 'supermarket') setKanbanType('')
          }}
          className={`mt-1 ${inputClass} w-40`}
        >
          <option value="standard">{t('bufferStandard')}</option>
          <option value="supermarket">{t('bufferSupermarket')}</option>
          <option value="fifo">{t('bufferFifo')}</option>
          <option value="continuous">{t('bufferContinuous')}</option>
          <option value="safety_stock">{t('bufferSafetyStock')}</option>
        </select>
      </div>
      <div>
        <label htmlFor="buf-flow" className="block text-xs font-medium text-zinc-600">
          <TermTooltip term="flowStyle">{t('flowStyleLabel')}</TermTooltip>
        </label>
        <select
          id="buf-flow"
          value={flowStyle}
          onChange={(e) => setFlowStyle(e.target.value)}
          className={`mt-1 ${inputClass} w-40`}
        >
          <option value="">{t('flowAuto')}</option>
          <option value="push">{t('flowPush')}</option>
          <option value="pull">{t('flowPull')}</option>
          <option value="shipment">{t('flowShipment')}</option>
        </select>
      </div>
      {bufferType === 'supermarket' && (
        <div>
          <label htmlFor="buf-kanban" className="block text-xs font-medium text-zinc-600">
            <TermTooltip term="kanbanType">{t('kanbanTypeLabel')}</TermTooltip>
          </label>
          <select
            id="buf-kanban"
            value={kanbanType}
            onChange={(e) => setKanbanType(e.target.value)}
            className={`mt-1 ${inputClass} w-40`}
          >
            <option value="">{t('kanbanProduction')}</option>
            <option value="transport">{t('kanbanWithdrawal')}</option>
          </select>
        </div>
      )}
      {error && (
        <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <button type="submit" disabled={isSaving} className={primaryButtonClass}>
        {t('save')}
      </button>
      <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:underline">
        {t('close')}
      </button>
    </form>
  )
}

function AnchorEditPanel({
  projectId,
  anchor,
  currentLabel,
  onClose,
}: {
  projectId: string
  anchor: 'supplier' | 'customer' | 'erp'
  currentLabel: string
  onClose: () => void
}) {
  const router = useRouter()
  const demoMutate = useDemoMutate()
  const [, startTransition] = useTransition()
  const t = useTranslations('Editor')
  const tCanvas = useTranslations('Canvas')
  const [value, setValue] = useState(currentLabel)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const title =
    anchor === 'supplier'
      ? tCanvas('supplier')
      : anchor === 'customer'
        ? tCanvas('customer')
        : t('anchorErp')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) {
      setError(t('errorNotEmpty'))
      return
    }
    setError(null)
    setIsSaving(true)
      if (demoMutate) {
        demoMutate((s) =>
          demoOperations.updateProjectLabels(s, {
            ...(anchor === 'supplier' ? { supplier_name: value.trim() } : {}),
            ...(anchor === 'customer' ? { customer_name: value.trim() } : {}),
            ...(anchor === 'erp' ? { erp_label: value.trim() } : {}),
          })
        )
        onClose()
        return
      }
    startTransition(async () => {
      try {
        await updateProjectLabels(projectId, {
          ...(anchor === 'supplier' ? { supplierName: value.trim() } : {}),
          ...(anchor === 'customer' ? { customerName: value.trim() } : {}),
          ...(anchor === 'erp' ? { erpLabel: value.trim() } : {}),
        })
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSaving'))
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-surface border border-brand-600 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-950">{title} bearbeiten</h2>
      <div>
        <label htmlFor="anchor-label" className="block text-xs font-medium text-zinc-600">
          Bezeichnung
        </label>
        <input
          id="anchor-label"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`mt-1 ${inputClass} w-56`}
        />
      </div>
      {error && (
        <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <button type="submit" disabled={isSaving} className={primaryButtonClass}>
        {t('save')}
      </button>
      <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:underline">
        {t('close')}
      </button>
    </form>
  )
}

function ProcessBox({
  process,
  x,
  y,
  isSelected,
  isBottleneck,
  counterScale,
  onSelect,
}: {
  process: Process
  x: number
  y: number
  isSelected: boolean
  isBottleneck: boolean
  /** 1 / stageScale — see the bottleneck badge below. */
  counterScale: number
  onSelect: () => void
}) {
  const tCanvas = useTranslations('Canvas')
  const boxStroke = isSelected ? ACCENT : isBottleneck ? BOTTLENECK : INK
  return (
    <Group
      x={x}
      y={y}
      onClick={onSelect}
      onTap={onSelect}
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'pointer'
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'default'
      }}
    >
      {process.is_pacemaker && (
        // Scheduling-point marker (Schrittmacher) — a small pin above the box.
        <RegularPolygon
          sides={3}
          radius={7}
          rotation={180}
          x={PROCESS_WIDTH / 2}
          y={-12}
          fill={INK}
        />
      )}
      <Rect
        width={PROCESS_WIDTH}
        height={PROCESS_HEIGHT}
        fill="#ffffff"
        stroke={boxStroke}
        strokeWidth={isSelected || isBottleneck ? 2 : 1.5}
        cornerRadius={3}
        shadowColor="#000000"
        shadowBlur={8}
        shadowOffsetY={2}
        shadowOpacity={0.08}
      />
      {/* Operator count — the standard small circled number above the box. */}
      <Circle x={PROCESS_WIDTH} y={0} radius={11} fill="#ffffff" stroke={INK} strokeWidth={1.5} />
      <Text
        text={String(process.operator_count)}
        x={PROCESS_WIDTH - 11}
        y={-6}
        width={22}
        align="center"
        fontSize={CANVAS_TEXT.value}
        fontStyle="bold"
        fill={INK}
      />
      {isBottleneck && (
        // Kapazitäts-Warnung: effektive Zykluszeit (C/T ÷ OEE) übersteigt die Taktzeit.
        <>
          <Circle x={0} y={0} radius={9} fill={BOTTLENECK} />
          <Text text="!" x={-9} y={-6} width={18} align="center" fontSize={CANVAS_TEXT.value} fontStyle="bold" fill="#ffffff" />
        </>
      )}
      <Text
        text={process.name}
        width={PROCESS_WIDTH}
        align="center"
        y={10}
        fontSize={CANVAS_TEXT.heading}
        fontStyle="bold"
        fill={INK}
      />
      <Rect x={10} y={34} width={PROCESS_WIDTH - 20} height={1} fill="#d4d4d8" />
      <Text
        text={`C/T: ${process.cycle_time} min${
          process.operator_count > 1
            ? ` (eff. ${effectiveCycleTime({ cycleTime: process.cycle_time, operatorCount: process.operator_count }).toFixed(1)})`
            : ''
        }\nC/O: ${process.changeover_time} min\nOEE: ${process.oee}%`}
        width={PROCESS_WIDTH}
        align="center"
        y={39}
        fontSize={CANVAS_TEXT.label}
        fill="#3f3f46"
        lineHeight={1.5}
      />
      {isBottleneck && (
        // The most important thing this box has to say, and it used to be the
        // least readable: 8.5px inside a stage drawn at 70 % rendered at ~6px.
        // Counter-scaling pins it to a constant on-screen size, the same trick
        // the PLT summary box uses. Shortened to "Engpass" so the label still
        // fits the box width once it stops shrinking with it — the "ggü. Takt"
        // part is spelled out in the Austaktungsdiagramm below the canvas.
        <Group x={PROCESS_WIDTH / 2} y={86} scaleX={counterScale} scaleY={counterScale}>
          <Text
            text={tCanvas('bottleneck')}
            width={PROCESS_WIDTH}
            offsetX={PROCESS_WIDTH / 2}
            align="center"
            fontSize={CANVAS_TEXT.label}
            fontStyle="bold"
            fill={BOTTLENECK}
          />
        </Group>
      )}
      {classificationMarker(process.classification) && (
        // Wertschöpfungs-Klassifizierung: a short text tag, not a fill-color
        // tint — keeps the print-standard B&W convention intact, same
        // restrained-accent approach as the bottleneck border/pacemaker pin.
        // Bottom-left corner is free (bottleneck "!" uses top-left, operator
        // count uses top-right, pacemaker pin sits above the box, Kaizen-Blitz
        // uses bottom-right — see below).
        <Text
          text={classificationMarker(process.classification) ?? ''}
          x={4}
          y={PROCESS_HEIGHT - 13}
          fontSize={CANVAS_TEXT.tag}
          fontStyle="bold"
          fill={
            process.classification === 'nva'
              ? BOTTLENECK
              : process.classification === 'necessary_nva'
                ? '#b45309' // amber-700 — matches the amber warning banners used elsewhere
                : '#71717a' // zinc-500 — neutral marker for VA, not a warning
          }
        />
      )}
      {(process.kaizen_note ?? '').trim().length > 0 && (
        // [Future-State-Wizard, Frage 8] Kaizen-Blitz. Der Plan sah das
        // Symbol oberhalb der Box mit Text darunter vor; dort stehen bei
        // einem Schrittmacher-Prozess aber schon der Steuerungs-Pin (mittig)
        // und immer der Bedienerkreis (oben rechts) — zusaetzlicher Text
        // waere entweder eng an einem von beiden vorbei oder wuerde in die
        // von der ERP-Box einlaufenden Informationspfeile hineinragen. Die
        // freie untere rechte Ecke (Klassifizierung spiegelbildlich unten
        // links) traegt das Symbol ohne diesen Konflikt; der volle Text
        // steht in Frage 8 des Wizards, wo er auch bearbeitet wird — auf der
        // Karte selbst waere fuer mehr als ein Emblem ohnehin kein Platz,
        // ohne PROCESS_HEIGHT fuer jede Box in der Reihe zu vergroessern.
        <Star
          numPoints={6}
          innerRadius={3}
          outerRadius={7}
          x={PROCESS_WIDTH - 10}
          y={PROCESS_HEIGHT - 11}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={1.2}
        />
      )}
    </Group>
  )
}

function BufferMarker({
  x,
  y,
  wipCount,
  bufferType,
  isSelected,
  onSelect,
}: {
  x: number
  y: number
  wipCount: number
  bufferType: string
  isSelected: boolean
  onSelect: () => void
}) {
  const tCanvas = useTranslations('Canvas')
  const radius = BUFFER_SIZE / 2
  // An empty buffer is drawn faintly rather than hidden. A solid triangle
  // labelled "0" asserts inventory that is not there; hiding it would remove
  // the only place to enter some — the boundary slots in particular hold real
  // raw-material and finished-goods stock in a VSM. Faint reads as "nothing
  // here yet, click to fill", which is what it is.
  const isEmpty = wipCount === 0 && !isSelected
  const stroke = isSelected ? ACCENT : isEmpty ? EMPTY_BUFFER : INK
  const strokeWidth = isSelected ? 2 : 1.5

  return (
    <Group
      x={x}
      y={y}
      onClick={onSelect}
      onTap={onSelect}
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'pointer'
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'default'
      }}
    >
      {/* [UX-Audit 2026-08-16, kleinere Beobachtung] Unsichtbares Ziel,
          groesser als das sichtbare Dreieck: BUFFER_SIZE (50 Einheiten) misst
          am Zoom-Boden (MIN_READABLE_SCALE, 60 %) nur 30x30 px — deutlich
          unter den 44 px, die ein Finger sicher trifft. Der Puffer bleibt
          optisch unveraendert; nur die Trefferflaeche wird auf 74 Einheiten
          aufgeweitet, was am selben Zoom-Boden 44,4 px ergibt.
          `fill="transparent"` ist hier keine Kosmetik, sondern noetig, damit
          Konva die Flaeche ueberhaupt in den Hit-Test aufnimmt — ein Rect
          ganz ohne Fill wird nicht getroffen. */}
      <Rect
        x={-BUFFER_HIT_PADDING}
        y={-BUFFER_HIT_PADDING}
        width={BUFFER_SIZE + BUFFER_HIT_PADDING * 2}
        height={BUFFER_SIZE + BUFFER_HIT_PADDING * 2}
        fill="transparent"
      />
      {bufferType === 'supermarket' ? (
        <SupermarketIcon stroke={stroke} strokeWidth={strokeWidth} />
      ) : bufferType === 'fifo' ? (
        <FifoIcon stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        // 'standard' and 'safety_stock' share the same triangle — safety
        // stock is a labeled variant of it, not a separate shape.
        <RegularPolygon
          sides={3}
          radius={radius}
          x={radius}
          y={radius}
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {bufferType === 'safety_stock' && (
        <Text text={tCanvas('safetyStockAbbr')} width={BUFFER_SIZE} align="center" y={4} fontSize={CANVAS_TEXT.tag} fontStyle="bold" fill={stroke} />
      )}
      <Text
        text={String(wipCount)}
        width={BUFFER_SIZE}
        align="center"
        y={radius - 4}
        fontSize={CANVAS_TEXT.value}
        fontStyle="bold"
        fill={isEmpty ? EMPTY_BUFFER : INK}
      />
    </Group>
  )
}

// Pull-system endpoint: shelf/rack icon (3 compartments), per the standard
// "supermarket" symbol.
function SupermarketIcon({ stroke, strokeWidth }: { stroke: string; strokeWidth: number }) {
  const s = BUFFER_SIZE
  return (
    <>
      <Rect x={0} y={s * 0.15} width={s} height={s * 0.7} fill="#ffffff" stroke={stroke} strokeWidth={strokeWidth} />
      <Line points={[s * 0.33, s * 0.15, s * 0.33, s * 0.85]} stroke={stroke} strokeWidth={1} />
      <Line points={[s * 0.67, s * 0.15, s * 0.67, s * 0.85]} stroke={stroke} strokeWidth={1} />
    </>
  )
}

// Capped first-in-first-out lane between two processes without a supermarket.
function FifoIcon({ stroke, strokeWidth }: { stroke: string; strokeWidth: number }) {
  const s = BUFFER_SIZE
  return (
    <>
      <Rect x={0} y={s * 0.22} width={s} height={s * 0.56} fill="#ffffff" stroke={stroke} strokeWidth={strokeWidth} />
      <Text
        text="FIFO"
        x={0}
        y={s * 0.22}
        width={s}
        height={s * 0.56}
        align="center"
        verticalAlign="middle"
        fontSize={CANVAS_TEXT.tag}
        fontStyle="bold"
        fill={stroke}
      />
    </>
  )
}

// Curved withdrawal-pull arrow with a small kanban card marker, used for
// the downstream side of a supermarket instead of a straight push arrow.
// `kanbanType` picks the card's icon variant — 'transport' (withdrawal
// kanban, authorizes moving existing stock) vs the default production
// kanban (authorizes making more). Display-only distinction, not a full
// kanban-card simulation.
function PullArrow({
  points,
  kanbanType,
}: {
  points: [number, number, number, number]
  kanbanType?: string | null
}) {
  const [x1, y1, x2, y2] = points
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const px = -dy / len
  const py = dx / len
  const bow = 16
  const controlX = midX + px * bow
  const controlY = midY + py * bow

  return (
    <>
      <Arrow
        points={[x1, y1, controlX, controlY, x2, y2]}
        tension={0.5}
        stroke={INK}
        fill={INK}
        strokeWidth={2}
        pointerLength={9}
        pointerWidth={9}
      />
      <KanbanCardIcon x={controlX - 8} y={controlY - 10} kanbanType={kanbanType} />
    </>
  )
}

// Two icon variants for the small kanban card marker on a pull arrow:
// production kanban (default — two text lines, "make more of this") and
// transport/withdrawal kanban (a small arrow — "move existing stock here").
// Intentionally just an icon swap, not a real kanban-card count/simulation.
function KanbanCardIcon({ x, y, kanbanType }: { x: number; y: number; kanbanType?: string | null }) {
  const isTransport = kanbanType === 'transport'
  return (
    <Group x={x} y={y}>
      <Rect width={16} height={12} fill="#ffffff" stroke={INK} strokeWidth={1} />
      {isTransport ? (
        <Arrow points={[3, 6, 13, 6]} stroke={INK} fill={INK} strokeWidth={1.25} pointerLength={4} pointerWidth={4} />
      ) : (
        <>
          <Line points={[3, 4, 13, 4]} stroke={INK} strokeWidth={0.75} />
          <Line points={[3, 8, 13, 8]} stroke={INK} strokeWidth={0.75} />
        </>
      )}
    </Group>
  )
}

function CloudShape({
  x,
  y,
  label,
  isSelected,
  onSelect,
}: {
  x: number
  y: number
  label: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Group
      x={x}
      y={y}
      onClick={onSelect}
      onTap={onSelect}
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'pointer'
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'default'
      }}
    >
      <Rect
        width={CLOUD_SIZE}
        height={CLOUD_SIZE * 0.75}
        fill="#ffffff"
        stroke={isSelected ? ACCENT : INK}
        strokeWidth={isSelected ? 2 : 1.5}
        cornerRadius={16}
      />
      <Text
        text={label}
        width={CLOUD_SIZE}
        height={CLOUD_SIZE * 0.75}
        align="center"
        verticalAlign="middle"
        fontSize={CANVAS_TEXT.value}
        fontStyle="bold"
        fill={INK}
      />
    </Group>
  )
}

function ErpBox({
  x,
  y,
  label,
  isSelected,
  onSelect,
}: {
  x: number
  y: number
  label: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <Group
      x={x}
      y={y}
      onClick={onSelect}
      onTap={onSelect}
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'pointer'
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'default'
      }}
    >
      <Rect
        width={ERP_WIDTH}
        height={ERP_HEIGHT}
        fill="#ffffff"
        stroke={isSelected ? ACCENT : INK}
        strokeWidth={isSelected ? 2 : 1.5}
        cornerRadius={2}
      />
      <Text
        text={label}
        width={ERP_WIDTH}
        height={ERP_HEIGHT}
        align="center"
        verticalAlign="middle"
        fontSize={CANVAS_TEXT.value}
        fontStyle="bold"
        fill={INK}
        lineHeight={1.4}
      />
    </Group>
  )
}

/**
 * Nivellierungskasten (Heijunka-Box): ein klassisches Raster-Rechteck mit
 * Faechern fuer Kanban-Karten je Zeitintervall — hier symbolisch als 2x4-
 * Raster, weil dieses Datenmodell keine einzelnen Produktarten oder
 * Zeitscheiben kennt, gegen die man ein echtes Belegungsraster zeichnen
 * koennte. Das Symbol sagt "hier wird nivelliert", nicht "so ist es belegt".
 *
 * Der Pitch (Frage 7) steht als Unterschrift darunter, wenn gesetzt — er ist
 * die Zahl, die aus dem Symbol ein Mass macht: das Steuerungsintervall, in
 * dem tatsaechlich Kanban gezogen wird.
 */
function HeijunkaBox({ x, y, pitchMinutes }: { x: number; y: number; pitchMinutes: number | null }) {
  const tCanvas = useTranslations('Canvas')
  const COLUMNS = 4
  const LABEL_HEIGHT = 16
  const CAPTION_HEIGHT = 16
  const gridY = LABEL_HEIGHT
  const gridHeight = HEIJUNKA_HEIGHT - LABEL_HEIGHT - CAPTION_HEIGHT
  const colWidth = HEIJUNKA_WIDTH / COLUMNS

  return (
    <Group x={x} y={y}>
      <Rect width={HEIJUNKA_WIDTH} height={HEIJUNKA_HEIGHT} fill="#ffffff" stroke={INK} strokeWidth={1.5} cornerRadius={2} />
      <Text
        text={tCanvas('heijunka')}
        width={HEIJUNKA_WIDTH}
        y={2}
        align="center"
        fontSize={CANVAS_TEXT.label}
        fontStyle="bold"
        fill={INK}
      />
      <Rect x={0} y={gridY} width={HEIJUNKA_WIDTH} height={gridHeight} stroke={INK} strokeWidth={1} />
      {/* Drei senkrechte und eine waagrechte Trennlinie ergeben die acht
          Faecher — genug, um als Raster erkennbar zu sein, ohne eine
          Belegung vorzutaeuschen, die es nicht gibt. */}
      {Array.from({ length: COLUMNS - 1 }, (_, i) => (
        <Line
          key={i}
          points={[colWidth * (i + 1), gridY, colWidth * (i + 1), gridY + gridHeight]}
          stroke={INK}
          strokeWidth={1}
        />
      ))}
      <Line
        points={[0, gridY + gridHeight / 2, HEIJUNKA_WIDTH, gridY + gridHeight / 2]}
        stroke={INK}
        strokeWidth={1}
      />
      {pitchMinutes !== null && (
        <Text
          text={tCanvas('pitchCaption', { minutes: pitchMinutes })}
          width={HEIJUNKA_WIDTH}
          y={HEIJUNKA_HEIGHT - CAPTION_HEIGHT + 2}
          align="center"
          fontSize={CANVAS_TEXT.tag}
          fill="#3f3f46"
        />
      )}
    </Group>
  )
}

// Heavier block/chevron arrow for shipments to/from supplier and customer,
// visually distinct from the thin internal "push" arrows.
function ShipmentArrow({ points }: { points: [number, number, number, number] }) {
  const [x1, y1, x2, y2] = points
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const shaftHalf = 5
  const headLen = Math.min(14, len)
  const headHalf = 9
  const shaftEndX = x2 - ux * headLen
  const shaftEndY = y2 - uy * headLen

  const poly = [
    x1 + px * shaftHalf, y1 + py * shaftHalf,
    shaftEndX + px * shaftHalf, shaftEndY + py * shaftHalf,
    shaftEndX + px * headHalf, shaftEndY + py * headHalf,
    x2, y2,
    shaftEndX - px * headHalf, shaftEndY - py * headHalf,
    shaftEndX - px * shaftHalf, shaftEndY - py * shaftHalf,
    x1 - px * shaftHalf, y1 - py * shaftHalf,
  ]

  return <Line points={poly} closed fill={INK} stroke={INK} strokeWidth={1} />
}

function LadderSummary({
  x,
  yTop,
  yBottom,
  counterScale,
  leadTimeDays,
  valueAddMinutes,
}: {
  x: number
  yTop: number
  yBottom: number
  /** 1 / stageScale — cancels the canvas zoom so this box stays a constant
   * on-screen size no matter how far the diagram is zoomed out. A bigger
   * base font alone (the previous fix) still shrank proportionally with
   * the rest of the canvas and wasn't enough on its own. */
  counterScale: number
  leadTimeDays: number | null
  valueAddMinutes: number
}) {
  const tCanvas = useTranslations('Canvas')
  const width = 84
  // Fixed screen-pixel height now that this box no longer scales with the
  // canvas — no longer tied to the ladder step height (yBottom - yTop),
  // which was only meaningful back when the box scaled proportionally.
  const height = 76
  const anchorY = (yTop + yBottom) / 2
  return (
    <Group x={x} y={anchorY} scaleX={counterScale} scaleY={counterScale} offsetY={height / 2}>
      <Rect width={width} height={height} stroke={INK} strokeWidth={1.5} fill="#ffffff" />
      <Text text={tCanvas('leadTimeAbbr')} x={0} y={5} width={width} align="center" fontSize={CANVAS_TEXT.label} fill="#52525b" />
      <Text
        text={leadTimeDays !== null ? `${leadTimeDays.toFixed(1)} ${tCanvas('daysUnit')}` : '–'}
        x={0}
        y={17}
        width={width}
        align="center"
        fontSize={CANVAS_TEXT.heading}
        fontStyle="bold"
        fill={INK}
      />
      <Text text={tCanvas('valueAddedAbbr')} x={0} y={height - 30} width={width} align="center" fontSize={CANVAS_TEXT.label} fill="#52525b" />
      <Text
        text={`${valueAddMinutes.toFixed(1)} ${tCanvas('minUnit')}`}
        x={0}
        y={height - 18}
        width={width}
        align="center"
        fontSize={CANVAS_TEXT.heading}
        fontStyle="bold"
        fill={INK}
      />
    </Group>
  )
}
