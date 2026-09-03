// Pure positioning math for the VSM canvas auto-layout: process boxes are
// arranged left-to-right in a single row, with the supplier cloud fixed at
// the far left, the customer cloud trailing the last process, and inventory
// buffers centered in the gap between two consecutive processes.

export const PROCESS_WIDTH = 140
export const PROCESS_HEIGHT = 100
export const BUFFER_SIZE = 50
export const CLOUD_SIZE = 80
// Must clear the buffer triangle's own clearance radius (BUFFER_SIZE/2 + 6,
// see splitSegmentAroundGap in VSMCanvas.tsx) on *each* side, i.e.
// GAP/2 > BUFFER_SIZE/2 + 6, or the material-flow arrow collapses to a
// zero/negative-length segment and effectively disappears. 110 leaves a
// clearly visible ~24px arrow shaft on each side of the buffer symbol.
export const GAP = 110
export const ROW_START_X = 220
/** Vertical gap between the main row (lane 0) and each additional parallel lane below it. */
export const LANE_GAP = 40
export const ERP_WIDTH = 150
export const ERP_HEIGHT = 70
export const ERP_Y = 20
export const HEIJUNKA_WIDTH = 100
export const HEIJUNKA_HEIGHT = 60
/** Abstand zwischen ERP-Kasten und Heijunka-Box, in derselben Reihe. */
export const HEIJUNKA_GAP = 24
// Process row sits below the ERP box + dashed information-flow lines.
export const ROW_Y = ERP_Y + ERP_HEIGHT + 110

export interface Point {
  x: number
  y: number
}

/** Left-to-right positions for each process id, in the order given. */
export function autoLayoutProcessPositions(processIds: string[]): Record<string, Point> {
  const positions: Record<string, Point> = {}
  let cursorX = ROW_START_X

  for (const id of processIds) {
    positions[id] = { x: cursorX, y: ROW_Y }
    cursorX += PROCESS_WIDTH + GAP
  }

  return positions
}

/** Y of a given lane — 0 is the main row, 1+ are parallel rows stacked below it. */
export function laneY(lane: number): number {
  return ROW_Y + Math.max(0, lane) * (PROCESS_HEIGHT + LANE_GAP)
}

/**
 * Position for a process at a given position in the sequence (its index in
 * the chain order, left-to-right) and lane (0 = main row). Replaces manual
 * x/y dragging: a process's position is always *derived* from where it sits
 * in the sequence + which lane it's on, so boxes can never overlap or drift
 * out of alignment.
 */
export function slotPosition(sequenceIndex: number, lane = 0): Point {
  return { x: ROW_START_X + sequenceIndex * (PROCESS_WIDTH + GAP), y: laneY(lane) }
}

export function supplierCloudPosition(): Point {
  return { x: ROW_START_X - GAP - CLOUD_SIZE, y: ROW_Y + PROCESS_HEIGHT / 2 - CLOUD_SIZE / 2 }
}

export function customerCloudPosition(processCount: number): Point {
  const rowEndX = ROW_START_X + processCount * (PROCESS_WIDTH + GAP)
  return { x: rowEndX + GAP - GAP / 2, y: ROW_Y + PROCESS_HEIGHT / 2 - CLOUD_SIZE / 2 }
}

/** Position of the inventory buffer sitting between process[index] and process[index + 1]. */
export function bufferPosition(index: number): Point {
  const gapStartX = ROW_START_X + index * (PROCESS_WIDTH + GAP) + PROCESS_WIDTH
  const x = gapStartX + GAP / 2 - BUFFER_SIZE / 2
  const y = ROW_Y + PROCESS_HEIGHT / 2 - BUFFER_SIZE / 2
  return { x, y }
}

/** ERP / production-control box, centered above the supplier-to-customer span. */
export function erpBoxPosition(processCount: number): Point {
  const supplier = supplierCloudPosition()
  const customer = customerCloudPosition(processCount)
  const spanCenterX = (supplier.x + customer.x + CLOUD_SIZE) / 2
  return { x: spanCenterX - ERP_WIDTH / 2, y: ERP_Y }
}

/**
 * Heijunka-Box (Nivellierungskasten), direkt rechts neben dem ERP-Kasten in
 * derselben Reihe — analog zu erpBoxPosition, ein fester, vom Schrittmacher
 * unabhaengiger Anker. Der Schrittmacher selbst kann an beliebiger Stelle in
 * der Prozesskette stehen (und sich per Drag verschieben); eine an ihn
 * gebundene Position muesste jedem Positionswechsel folgen. Die Heijunka-Box
 * gehoert methodisch ohnehin an den Steuerungspunkt (ERP), nicht an den
 * Schrittmacher-Prozess selbst — direkt daneben ist deshalb kein Kompromiss,
 * sondern die naheliegende Stelle.
 */
export function heijunkaBoxPosition(processCount: number): Point {
  const erp = erpBoxPosition(processCount)
  return { x: erp.x + ERP_WIDTH + HEIJUNKA_GAP, y: ERP_Y }
}

// --- Dynamic geometry for draggable boxes -----------------------------
// Once a process box can be dragged off its auto-layout slot, buffers and
// arrows need to follow its *actual* position rather than the fixed
// formula above. These helpers work on arbitrary points instead.

export function boxRightEdge(pos: Point): Point {
  return { x: pos.x + PROCESS_WIDTH, y: pos.y + PROCESS_HEIGHT / 2 }
}

export function boxLeftEdge(pos: Point): Point {
  return { x: pos.x, y: pos.y + PROCESS_HEIGHT / 2 }
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
