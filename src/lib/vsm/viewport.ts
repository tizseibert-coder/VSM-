// Pure zoom/fit-to-view math for the canvas. The canvas itself (the "world")
// is drawn at a fixed content size (canvasWidth/canvasHeight in
// VSMCanvas.tsx); this module only computes how to scale/position that
// world inside a smaller, fixed-size viewport so a growing diagram never
// runs off-screen — it shrinks to fit instead.

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 2

/**
 * Never auto-fit below this — text (WIP numbers, ladder box) becomes
 * unreadable well before MIN_SCALE. Below this floor, a large diagram
 * should be panned instead of shrunk further; manual zoom-out (buttons/
 * wheel) can still go all the way to MIN_SCALE if the user explicitly
 * wants a full overview.
 */
export const MIN_READABLE_SCALE = 0.6

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Scale that fits `content` inside `viewport` (minus `padding` on each
 * side), never exceeding 100% — a small diagram should sit at its natural
 * size, not get blown up to fill the frame.
 */
export function computeFitScale(content: Size, viewport: Size, padding = 0): number {
  if (content.width <= 0 || content.height <= 0) return 1
  const availableWidth = Math.max(viewport.width - padding * 2, 1)
  const availableHeight = Math.max(viewport.height - padding * 2, 1)
  const scale = Math.min(availableWidth / content.width, availableHeight / content.height)
  return clampScale(Math.min(scale, 1))
}

/**
 * Like computeFitScale, but floored at MIN_READABLE_SCALE — used for the
 * *automatic* fit (on load / when the diagram grows) so text never
 * auto-shrinks past legibility. A diagram larger than the readable floor
 * simply overflows the viewport and is panned instead.
 */
export function computeAutoFitScale(content: Size, viewport: Size, padding = 0): number {
  return Math.max(computeFitScale(content, viewport, padding), MIN_READABLE_SCALE)
}
