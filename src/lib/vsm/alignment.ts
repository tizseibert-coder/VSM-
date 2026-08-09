// Pure snap-to-alignment math: when a dragged process box's top-left edge
// lands within `threshold` px of another box's edge, snap to it — keeps
// manually repositioned boxes "schön ausgerichtet" instead of drifting a
// few pixels off the row/column. Also reports which axis snapped so the
// canvas can draw a live guide line while dragging.

export interface AlignPoint {
  x: number
  y: number
}

export interface SnapResult {
  x: number
  y: number
  guideX: number | null
  guideY: number | null
}

export function snapToAlignment(candidate: AlignPoint, targets: AlignPoint[], threshold = 6): SnapResult {
  let x = candidate.x
  let y = candidate.y
  let guideX: number | null = null
  let guideY: number | null = null

  for (const target of targets) {
    if (guideX === null && Math.abs(candidate.x - target.x) <= threshold) {
      x = target.x
      guideX = target.x
    }
    if (guideY === null && Math.abs(candidate.y - target.y) <= threshold) {
      y = target.y
      guideY = target.y
    }
  }

  return { x, y, guideX, guideY }
}
