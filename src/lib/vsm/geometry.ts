// Pure coordinate math shared by the canvas: breaking a straight segment
// around a symbol sitting on it (so material-flow arrows don't visually run
// through the WIP triangle), and generating a lightning-bolt zigzag path
// for the "electronic information flow" VSM convention.

export interface Point {
  x: number
  y: number
}

/**
 * Splits the segment from `from` to `to` around its midpoint, leaving a gap
 * of `gapHalfWidth` on each side (e.g. for a symbol that sits on the line).
 * Returns the two points where the visible line segments should stop.
 */
export function splitSegmentAroundGap(from: Point, to: Point, gapHalfWidth: number): { near: Point; far: Point } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { near: from, far: to }

  const ux = dx / len
  const uy = dy / len
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  return {
    near: { x: midX - ux * gapHalfWidth, y: midY - uy * gapHalfWidth },
    far: { x: midX + ux * gapHalfWidth, y: midY + uy * gapHalfWidth },
  }
}

/**
 * Flat [x,y,x,y,...] point list for a 3-segment lightning-bolt path between
 * two points, used for the "electronic information flow" symbol.
 */
export function zigzagPoints(from: Point, to: Point, amplitude = 10): number[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return [from.x, from.y, to.x, to.y]

  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux

  const p1: Point = { x: from.x + dx / 3 + px * amplitude, y: from.y + dy / 3 + py * amplitude }
  const p2: Point = { x: from.x + (dx * 2) / 3 - px * amplitude, y: from.y + (dy * 2) / 3 - py * amplitude }

  return [from.x, from.y, p1.x, p1.y, p2.x, p2.y, to.x, to.y]
}
