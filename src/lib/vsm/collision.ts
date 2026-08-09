// Pure overlap detection/resolution for process boxes. Used after a manual
// drag so two boxes can never end up stacked exactly on top of each other —
// per the design brief: shapes must not overlap.

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * If `candidate` overlaps any box in `others`, nudges it sideways in `step`
 * increments (bounded by `maxAttempts`) until it's clear. Only ever moves
 * along x — the row stays visually level, which matches the single-row
 * auto-layout the rest of the canvas assumes.
 */
export function resolveOverlap(candidate: Box, others: Box[], step = 20, maxAttempts = 40): Box {
  let result = candidate
  let attempts = 0
  while (others.some((o) => boxesOverlap(result, o)) && attempts < maxAttempts) {
    result = { ...result, x: result.x + step }
    attempts++
  }
  return result
}
