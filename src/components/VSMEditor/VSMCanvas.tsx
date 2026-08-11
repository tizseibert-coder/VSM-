'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Stage, Layer, Rect, Text, Group, Arrow, Line, RegularPolygon, Circle } from 'react-konva'
import type Konva from 'konva'
import type { Tables } from '@/types/database'
import { calculateKpis } from '@/lib/vsm/calculations'
import { bufferGapIndices, findBuffer } from '@/lib/vsm/buffers'
import { splitSegmentAroundGap, zigzagPoints, type Point } from '@/lib/vsm/geometry'
import { computeAutoFitScale, clampScale } from '@/lib/vsm/viewport'
import { checkCapacity } from '@/lib/vsm/capacity'
import { findPushBeforePacemaker } from '@/lib/vsm/pacemakerConsistency'
import { TermTooltip } from './TermTooltip'
import { deriveChainOrder, moveInOrder, wouldCreateCycle } from '@/lib/vsm/chainOrder'
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
} from '@/lib/vsm/autoLayout'
import {
  addProcess,
  deleteProcess,
  importProcessesCsv,
  updateAnnualThroughput,
  updateProcess,
  reorderProcesses,
  updateProcessLane,
  setBufferWip,
  deleteBufferConnection,
  updateProjectLabels,
} from '@/app/editor/[projectId]/actions'

type Project = Tables<'projects'>
type Process = Tables<'processes'>
type Buffer = Tables<'inventory_buffers'>

const INK = '#18181b' // zinc-900 — used for all VSM line-art instead of pure black
const ACCENT = '#2563eb' // selection highlight, the one spot color allowed on the canvas
const BOTTLENECK = '#dc2626' // capacity-warning red — semantic, kept distinct from the accent
const LADDER_HIGH_STEP = 40
const LADDER_MARGIN_TOP = 70
const SUMMARY_WIDTH = 100 // matches LadderSummary's box width (84) + margin

type Selection =
  | { kind: 'process'; id: string }
  | { kind: 'buffer'; from: string | null; to: string | null }
  | { kind: 'anchor'; anchor: 'supplier' | 'customer' | 'erp' }
  | null

interface Props {
  project: Project
  /** null = current/live state; a scenarios.id = editing that Future-State copy. */
  scenarioId: string | null
  initialProcesses: Process[]
  initialBuffers: Buffer[]
}

export default function VSMCanvas({ project, scenarioId, initialProcesses, initialBuffers }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)

  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddCt, setQuickAddCt] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [throughputInput, setThroughputInput] = useState(
    project.annual_throughput?.toString() ?? ''
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Zoom/pan camera state: the world (canvasWidth x canvasHeight, computed
  // below) is drawn at a fixed size and a scale/offset transforms it into a
  // fixed-size viewport. `camera` is null until the user explicitly zooms,
  // pans, or clicks "Einpassen" — until then the view is *derived* fresh
  // every render from the current content size, so a growing diagram keeps
  // shrinking to fit automatically without needing an effect to chase it.
  const [camera, setCamera] = useState<{ scale: number; pos: Point } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 560 })
  const stageContainerRef = useRef<HTMLDivElement>(null)

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

  const kpis = useMemo(
    () =>
      calculateKpis({
        processes: processes.map((p) => ({ cycleTime: p.cycle_time, operatorCount: p.operator_count })),
        buffers: buffers.map((b) => ({ wipCount: b.wip_count })),
        annualThroughput: liveAnnualThroughput,
      }),
    [processes, buffers, liveAnnualThroughput]
  )

  const supplierPos = supplierCloudPosition()
  const supplierRight: Point = {
    x: supplierPos.x + CLOUD_SIZE,
    y: supplierPos.y + (CLOUD_SIZE * 0.75) / 2,
  }
  const customerPos = customerCloudPosition(processes.length)
  const customerLeft: Point = { x: customerPos.x, y: customerPos.y + (CLOUD_SIZE * 0.75) / 2 }
  const erpPos = erpBoxPosition(processes.length)

  // Sits below whichever lane is drawn lowest, so it never overlaps a
  // parallel row.
  const ladderLowY = laneY(maxLane) + PROCESS_HEIGHT + LADDER_MARGIN_TOP
  const ladderHighY = ladderLowY - LADDER_HIGH_STEP

  const canvasWidth = Math.max(900, customerPos.x + CLOUD_SIZE + 60 + SUMMARY_WIDTH)
  const canvasHeight = ladderLowY + 60

  // Fit-scale/position for the current content size — recomputed every
  // render (cheap arithmetic), not stored in state. This is what "Einpassen"
  // resets to, and what's shown automatically before the user ever touches
  // zoom/pan, including right after adding the diagram's first processes.
  const autoFitScale = computeAutoFitScale({ width: canvasWidth, height: canvasHeight }, viewportSize, 24)
  const autoFitPos: Point = { x: (viewportSize.width - canvasWidth * autoFitScale) / 2, y: 16 }
  const stageScale = camera?.scale ?? autoFitScale
  const stagePos = camera?.pos ?? autoFitPos

  function handleFitToView() {
    setCamera(null) // back to automatic — also resumes auto-shrinking as the diagram grows
  }

  // Measure the viewport (container width, fixed height) on mount and on
  // resize, so the stage always fills its card without native scrolling.
  useEffect(() => {
    function measure() {
      const el = stageContainerRef.current
      if (el) setViewportSize({ width: el.clientWidth, height: 560 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    // Plain scrolling must never zoom the canvas — the form sits right below
    // it on the page, so an un-gated wheel handler turns "scroll down to the
    // quick-add bar" into an accidental zoom. Match the Figma/Google-Maps
    // convention: only Strg/Cmd + wheel zooms; a bare wheel is left alone so
    // the browser scrolls the page normally.
    if (!e.evt.ctrlKey && !e.evt.metaKey) return
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
      const days = buffer && kpis.dailyDemand ? buffer.wip_count / kpis.dailyDemand : null
      segments.push({
        x1: from.x,
        x2: to.x,
        y: ladderHighY,
        label: days !== null ? `${days.toFixed(1)} T` : buffer ? `${buffer.wip_count} Stk` : '0',
        kind: 'wait',
      })

      if (g < orderedProcesses.length - 1) {
        const process = orderedProcesses[g + 1]
        const pos = positions[process.id]
        segments.push({
          x1: pos.x,
          x2: pos.x + PROCESS_WIDTH,
          y: ladderLowY,
          label: `${process.cycle_time} min`,
          kind: 'process',
        })
      }
    }
    return segments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedProcesses, buffers, positions, kpis.dailyDemand, ladderHighY, ladderLowY])

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
      setError('Name und Zykluszeit (Minuten) sind erforderlich.')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await addProcess(project.id, scenarioId, { name, cycleTime })
        setQuickAddName('')
        setQuickAddCt('')
        router.refresh()
        nameInputRef.current?.focus()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen.')
      }
    })
  }

  function handleThroughputBlur() {
    setError(null)
    startTransition(async () => {
      try {
        await updateAnnualThroughput(project.id, liveAnnualThroughput)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
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
    startTransition(async () => {
      try {
        await reorderProcesses(project.id, scenarioId, newOrder)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reihenfolge konnte nicht geändert werden.')
      }
    })
  }

  function handleChangeLane(processId: string, lane: number) {
    setError(null)
    startTransition(async () => {
      try {
        await updateProcessLane(project.id, processId, Math.max(0, lane))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Spur konnte nicht geändert werden.')
      }
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Live KPI bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label={<TermTooltip term="cycleTimeSum">Bearbeitungszeit</TermTooltip>}
          value={`${kpis.totalCycleTimeMinutes.toFixed(1)} min`}
        />
        <KpiTile
          label={<TermTooltip term="leadTime">Durchlaufzeit</TermTooltip>}
          value={
            kpis.totalLeadTimeDays > 0 || liveAnnualThroughput
              ? `${kpis.totalLeadTimeDays.toFixed(1)} Tage`
              : '–'
          }
        />
        <KpiTile
          label={<TermTooltip term="pce">Wertschöpfungsanteil</TermTooltip>}
          value={
            kpis.valueAddedRatioPercent !== null
              ? `${kpis.valueAddedRatioPercent.toFixed(2)} %`
              : '–'
          }
        />
        <KpiTile
          label={<TermTooltip term="taktTime">Taktzeit</TermTooltip>}
          value={kpis.taktTimeMinutes !== null ? `${kpis.taktTimeMinutes.toFixed(1)} min` : '–'}
        />
      </div>

      {/* Customer demand input — drives lead time / takt live */}
      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="throughput" className="text-sm text-zinc-600 dark:text-zinc-400">
          Jahresbedarf Kunde (Stück/Jahr)
        </label>
        <input
          id="throughput"
          type="number"
          min={0}
          value={throughputInput}
          onChange={(e) => setThroughputInput(e.target.value)}
          onBlur={handleThroughputBlur}
          placeholder="z. B. 50000"
          className="w-32 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!pacemaker && processes.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Kein <TermTooltip term="pacemaker">Schrittmacher-Prozess</TermTooltip> festgelegt — die Produktionssteuerung
          sendet den Auftrag aktuell an alle Prozesse. Lege im Prozess-Panel einen Schrittmacher fest, um das korrekt
          darzustellen.
        </p>
      )}

      {pushBeforePacemaker.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Vor dem <TermTooltip term="pacemaker">Schrittmacher-Prozess</TermTooltip> läuft noch mind. eine Verbindung
          als Push statt als Supermarkt/FIFO ({pushBeforePacemaker.length}×). Methodisch braucht alles vor dem
          Schrittmacher ein Pull-System (Supermarkt oder FIFO) — sonst baut sich davor unkontrolliert Bestand auf.
        </p>
      )}

      {/* Zoom controls — the stage auto-fits on load and whenever the
          diagram grows; this is just for manual override. Wheel-zoom needs
          Strg/Cmd (see handleWheel) so a normal scroll down to the toolbar
          below never zooms the canvas by accident. */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-400 dark:text-zinc-600">Strg/Cmd + Mausrad zum Zoomen</p>
        <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => setCamera({ scale: clampScale(stageScale / 1.2), pos: stagePos })}
            className="rounded-full px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-label="Verkleinern"
          >
            −
          </button>
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-500">
            {Math.round(stageScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setCamera({ scale: clampScale(stageScale * 1.2), pos: stagePos })}
            className="rounded-full px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-label="Vergrößern"
          >
            +
          </button>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <button
            type="button"
            onClick={handleFitToView}
            className="rounded-full px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Einpassen
          </button>
        </div>
      </div>

      {/* Canvas — standard VSM black-and-white line art on a white ground.
          Information flow (dashed/zigzag, ERP) above the process row,
          material flow (solid/block arrows) at the row, Zeitleiter below. */}
      <div
        ref={stageContainerRef}
        className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
      >
        <Stage
          width={viewportSize.width}
          height={viewportSize.height}
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
                    fontSize={10}
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
      </div>

      {processes.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Noch keine Prozesse. Leg unten den ersten an.
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

      {selection?.kind === 'anchor' && (
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

      {/* Toolbar: quick-add + CSV import, grouped in one bordered block */}
      <div className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <form onSubmit={handleQuickAddSubmit} className="flex flex-wrap items-end gap-3">
          <Field label="Prozessname" htmlFor="qa-name">
            <input
              id="qa-name"
              ref={nameInputRef}
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder="z. B. Drehen"
              className="w-40"
            />
          </Field>
          <Field label={<TermTooltip term="processCycleTime">Zykluszeit (min)</TermTooltip>} htmlFor="qa-ct">
            <input
              id="qa-ct"
              value={quickAddCt}
              onChange={(e) => setQuickAddCt(e.target.value)}
              placeholder="z. B. 3.5"
              className="w-28"
            />
          </Field>
          <button type="submit" className={primaryButtonClass}>
            + Hinzufügen
          </button>

          <div className="ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFile}
              className="hidden"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className={secondaryButtonClass}>
              CSV importieren
            </button>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Spalten: name, cycle_time, oee, wip
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'
const primaryButtonClass =
  'rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200'
const secondaryButtonClass =
  'rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'

function Field({ label, htmlFor, children }: { label: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <div className="mt-1 [&>input]:rounded-lg [&>input]:border [&>input]:border-zinc-300 [&>input]:px-2 [&>input]:py-1.5 [&>input]:text-sm [&>input]:dark:border-zinc-700 [&>input]:dark:bg-zinc-900 [&>input]:focus:outline-none [&>input]:focus:ring-2 [&>input]:focus:ring-blue-600">
        {children}
      </div>
    </div>
  )
}

function KpiTile({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-500 dark:text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
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
  const [, startTransition] = useTransition()
  const [name, setName] = useState(process.name)
  const [cycleTime, setCycleTime] = useState(String(process.cycle_time))
  const [oee, setOee] = useState(String(process.oee))
  const [operatorCount, setOperatorCount] = useState(String(process.operator_count))
  const [changeoverTime, setChangeoverTime] = useState(String(process.changeover_time))
  const [isPacemaker, setIsPacemaker] = useState(process.is_pacemaker)
  const [beforeWipInput, setBeforeWipInput] = useState(String(beforeWip))
  const [afterWipInput, setAfterWipInput] = useState(String(afterWip))
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
        setConnectionError(err instanceof Error ? err.message : 'Verbindung konnte nicht angelegt werden.')
      }
    })
  }

  function handleAddSuccessor() {
    if (!addSuccessorId) return
    setConnectionError(null)
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
        setConnectionError(err instanceof Error ? err.message : 'Verbindung konnte nicht angelegt werden.')
      }
    })
  }

  function handleDisconnect(bufferId: string) {
    setConnectionError(null)
    startTransition(async () => {
      try {
        await deleteBufferConnection(projectId, bufferId)
        router.refresh()
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : 'Verbindung konnte nicht getrennt werden.')
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
      setError('Bitte alle Felder gültig ausfüllen.')
      return
    }

    setError(null)
    setIsSaving(true)
    startTransition(async () => {
      try {
        await updateProcess(projectId, process.id, {
          name: name.trim(),
          cycleTime: ct,
          oee: oeeNum,
          operatorCount: operatorCountNum,
          changeoverTime: changeoverTimeNum,
          isPacemaker,
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
        setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
        setIsSaving(false)
      }
    })
  }

  function handleDelete() {
    setIsSaving(true)
    startTransition(async () => {
      try {
        await deleteProcess(projectId, process.id)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen.')
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 rounded-2xl border border-blue-600 bg-white p-4 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Prozess bearbeiten</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-500"
        >
          Schließen
        </button>
      </div>

      {/* Position: Reihenfolge (←/→) verdrahtet die Puffer-Kette automatisch
          neu; Spur (↑/↓) versetzt die Box auf eine parallele Reihe. Ersetzt
          das frühere freie Ziehen — dadurch keine Überschneidungen mehr. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500">Position</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveInSequence('earlier')}
            disabled={!canMoveEarlier}
            className={secondaryButtonClass}
            aria-label="Früher in der Reihenfolge"
            title="Früher in der Reihenfolge"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onMoveInSequence('later')}
            disabled={!canMoveLater}
            className={secondaryButtonClass}
            aria-label="Später in der Reihenfolge"
            title="Später in der Reihenfolge"
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
            aria-label="Spur höher (zurück zur Hauptlinie)"
            title="Spur höher"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onChangeLane(process.lane + 1)}
            className={secondaryButtonClass}
            aria-label="Spur tiefer (parallele Reihe)"
            title="Spur tiefer — z. B. für parallele Prozesse"
          >
            ↓
          </button>
        </div>
        {process.lane > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-500">Spur {process.lane + 1}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="ep-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
          </label>
          <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-ct" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="processCycleTime">Zykluszeit (min)</TermTooltip>
          </label>
          <input id="ep-ct" value={cycleTime} onChange={(e) => setCycleTime(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-co" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="changeoverTime">Rüstzeit C/O (min)</TermTooltip>
          </label>
          <input
            id="ep-co"
            value={changeoverTime}
            onChange={(e) => setChangeoverTime(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="ep-oee" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="oee">OEE (%)</TermTooltip>
          </label>
          <input id="ep-oee" value={oee} onChange={(e) => setOee(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="ep-operators" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="operatorCount">Bediener</TermTooltip>
          </label>
          <input
            id="ep-operators"
            value={operatorCount}
            onChange={(e) => setOperatorCount(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="ep-before" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="wip">WIP davor</TermTooltip>
          </label>
          <input
            id="ep-before"
            value={beforeWipInput}
            onChange={(e) => setBeforeWipInput(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="ep-after" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="wip">WIP danach</TermTooltip>
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
      <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500">Verbindungen</span>

        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Vorgänger</div>
            <ul className="mt-1 space-y-1">
              {incomingEdges.map((edge) => (
                <li key={edge.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{processLabel(edge.from_process_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(edge.id)}
                    className="text-red-700 hover:underline dark:text-red-400"
                    aria-label={`Verbindung von ${processLabel(edge.from_process_id)} trennen`}
                  >
                    ✕ trennen
                  </button>
                </li>
              ))}
              {incomingEdges.length === 0 && <li className="text-xs text-zinc-400">Keine</li>}
            </ul>
            {predecessorCandidates.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <select
                  value={addPredecessorId}
                  onChange={(e) => setAddPredecessorId(e.target.value)}
                  className={`${inputClass} text-xs`}
                >
                  <option value="">+ Vorgänger wählen…</option>
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
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Nachfolger</div>
            <ul className="mt-1 space-y-1">
              {outgoingEdges.map((edge) => (
                <li key={edge.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{processLabel(edge.to_process_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(edge.id)}
                    className="text-red-700 hover:underline dark:text-red-400"
                    aria-label={`Verbindung zu ${processLabel(edge.to_process_id)} trennen`}
                  >
                    ✕ trennen
                  </button>
                </li>
              ))}
              {outgoingEdges.length === 0 && <li className="text-xs text-zinc-400">Keine</li>}
            </ul>
            {successorCandidates.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <select
                  value={addSuccessorId}
                  onChange={(e) => setAddSuccessorId(e.target.value)}
                  className={`${inputClass} text-xs`}
                >
                  <option value="">+ Nachfolger wählen…</option>
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
          <p className="mt-2 text-xs text-red-700 dark:text-red-400">{connectionError}</p>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={isPacemaker} onChange={(e) => setIsPacemaker(e.target.checked)} />
        <TermTooltip term="pacemaker">Schrittmacher-Prozess</TermTooltip> (bekommt den Auftrag direkt von der
        Produktionssteuerung)
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button type="submit" disabled={isSaving} className={primaryButtonClass}>
          Speichern
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSaving}
          className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Prozess löschen
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
  const [, startTransition] = useTransition()
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
      setError('Bitte eine gültige Zahl eingeben.')
      return
    }
    setError(null)
    setIsSaving(true)
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
        setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-blue-600 bg-white p-4 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        <TermTooltip term="wip">Lagerbestand (WIP)</TermTooltip>
      </h2>
      <div>
        <label htmlFor="buf-wip" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Stück
        </label>
        <input id="buf-wip" value={value} onChange={(e) => setValue(e.target.value)} className={`mt-1 ${inputClass} w-28`} />
      </div>
      <div>
        <label htmlFor="buf-type" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <TermTooltip term="bufferType">Lager-Typ</TermTooltip>
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
          <option value="standard">Standard (unkontrolliert)</option>
          <option value="supermarket">Supermarkt (Pull)</option>
          <option value="fifo">FIFO-Bahn</option>
          <option value="continuous">Continuous Flow (One-Piece)</option>
        </select>
      </div>
      <div>
        <label htmlFor="buf-flow" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <TermTooltip term="flowStyle">Pfeil-Typ</TermTooltip>
        </label>
        <select
          id="buf-flow"
          value={flowStyle}
          onChange={(e) => setFlowStyle(e.target.value)}
          className={`mt-1 ${inputClass} w-40`}
        >
          <option value="">Automatisch</option>
          <option value="push">Push</option>
          <option value="pull">Pull</option>
          <option value="shipment">Shipment</option>
        </select>
      </div>
      {bufferType === 'supermarket' && (
        <div>
          <label htmlFor="buf-kanban" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <TermTooltip term="kanbanType">Kanban-Typ</TermTooltip>
          </label>
          <select
            id="buf-kanban"
            value={kanbanType}
            onChange={(e) => setKanbanType(e.target.value)}
            className={`mt-1 ${inputClass} w-40`}
          >
            <option value="">Produktions-Kanban</option>
            <option value="transport">Transport-Kanban</option>
          </select>
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}
      <button type="submit" disabled={isSaving} className={primaryButtonClass}>
        Speichern
      </button>
      <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
        Schließen
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
  const [, startTransition] = useTransition()
  const [value, setValue] = useState(currentLabel)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const title = anchor === 'supplier' ? 'Lieferant' : anchor === 'customer' ? 'Kunde' : 'ERP / Produktionssteuerung'

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) {
      setError('Darf nicht leer sein.')
      return
    }
    setError(null)
    setIsSaving(true)
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
        setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
        setIsSaving(false)
      }
    })
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-blue-600 bg-white p-4 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title} bearbeiten</h2>
      <div>
        <label htmlFor="anchor-label" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}
      <button type="submit" disabled={isSaving} className={primaryButtonClass}>
        Speichern
      </button>
      <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:underline dark:text-zinc-500">
        Schließen
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
  onSelect,
}: {
  process: Process
  x: number
  y: number
  isSelected: boolean
  isBottleneck: boolean
  onSelect: () => void
}) {
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
        fontSize={11}
        fontStyle="bold"
        fill={INK}
      />
      {isBottleneck && (
        // Kapazitäts-Warnung: effektive Zykluszeit (C/T ÷ OEE) übersteigt die Taktzeit.
        <>
          <Circle x={0} y={0} radius={9} fill={BOTTLENECK} />
          <Text text="!" x={-9} y={-6} width={18} align="center" fontSize={12} fontStyle="bold" fill="#ffffff" />
        </>
      )}
      <Text
        text={process.name}
        width={PROCESS_WIDTH}
        align="center"
        y={10}
        fontSize={13}
        fontStyle="bold"
        fill={INK}
      />
      <Rect x={10} y={34} width={PROCESS_WIDTH - 20} height={1} fill="#d4d4d8" />
      <Text
        text={`C/T: ${process.cycle_time} min\nC/O: ${process.changeover_time} min\nOEE: ${process.oee}%`}
        width={PROCESS_WIDTH}
        align="center"
        y={39}
        fontSize={10}
        fill="#3f3f46"
        lineHeight={1.5}
      />
      {isBottleneck && (
        <Text
          text="⚠ Engpass ggü. Takt"
          width={PROCESS_WIDTH}
          align="center"
          y={86}
          fontSize={8.5}
          fontStyle="bold"
          fill={BOTTLENECK}
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
  const radius = BUFFER_SIZE / 2
  const stroke = isSelected ? ACCENT : INK
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
      {bufferType === 'supermarket' ? (
        <SupermarketIcon stroke={stroke} strokeWidth={strokeWidth} />
      ) : bufferType === 'fifo' ? (
        <FifoIcon stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
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
      <Text
        text={String(wipCount)}
        width={BUFFER_SIZE}
        align="center"
        y={radius - 4}
        fontSize={11}
        fontStyle="bold"
        fill={INK}
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
        fontSize={8}
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
        fontSize={12}
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
        fontSize={11}
        fontStyle="bold"
        fill={INK}
        lineHeight={1.4}
      />
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
  leadTimeDays: number
  valueAddMinutes: number
}) {
  const width = 84
  // Fixed screen-pixel height now that this box no longer scales with the
  // canvas — no longer tied to the ladder step height (yBottom - yTop),
  // which was only meaningful back when the box scaled proportionally.
  const height = 76
  const anchorY = (yTop + yBottom) / 2
  return (
    <Group x={x} y={anchorY} scaleX={counterScale} scaleY={counterScale} offsetY={height / 2}>
      <Rect width={width} height={height} stroke={INK} strokeWidth={1.5} fill="#ffffff" />
      <Text text="LT" x={0} y={5} width={width} align="center" fontSize={10} fill="#52525b" />
      <Text
        text={`${leadTimeDays.toFixed(1)} T`}
        x={0}
        y={17}
        width={width}
        align="center"
        fontSize={13}
        fontStyle="bold"
        fill={INK}
      />
      <Text text="VA" x={0} y={height - 30} width={width} align="center" fontSize={10} fill="#52525b" />
      <Text
        text={`${valueAddMinutes.toFixed(1)} m`}
        x={0}
        y={height - 18}
        width={width}
        align="center"
        fontSize={13}
        fontStyle="bold"
        fill={INK}
      />
    </Group>
  )
}
