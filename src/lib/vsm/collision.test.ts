import { describe, expect, it } from 'vitest'
import { boxesOverlap, resolveOverlap } from './collision'

const SIZE = { width: 140, height: 100 }

describe('boxesOverlap', () => {
  it('detects two overlapping boxes', () => {
    expect(boxesOverlap({ x: 0, y: 0, ...SIZE }, { x: 50, y: 0, ...SIZE })).toBe(true)
  })

  it('detects two identical (fully stacked) boxes', () => {
    expect(boxesOverlap({ x: 100, y: 100, ...SIZE }, { x: 100, y: 100, ...SIZE })).toBe(true)
  })

  it('returns false when boxes only touch edge-to-edge', () => {
    expect(boxesOverlap({ x: 0, y: 0, ...SIZE }, { x: SIZE.width, y: 0, ...SIZE })).toBe(false)
  })

  it('returns false for clearly separate boxes', () => {
    expect(boxesOverlap({ x: 0, y: 0, ...SIZE }, { x: 500, y: 500, ...SIZE })).toBe(false)
  })
})

describe('resolveOverlap', () => {
  it('leaves a non-overlapping box untouched', () => {
    const candidate = { x: 0, y: 0, ...SIZE }
    const result = resolveOverlap(candidate, [{ x: 500, y: 0, ...SIZE }])
    expect(result).toEqual(candidate)
  })

  it('nudges an overlapping box until it is clear', () => {
    const candidate = { x: 100, y: 100, ...SIZE }
    const others = [{ x: 100, y: 100, ...SIZE }]
    const result = resolveOverlap(candidate, others, 20)

    expect(boxesOverlap(result, others[0])).toBe(false)
    expect(result.y).toBe(candidate.y) // only ever moves horizontally
  })

  it('keeps nudging until clear of every other box, not just the first', () => {
    const candidate = { x: 100, y: 100, ...SIZE }
    const others = [
      { x: 100, y: 100, ...SIZE },
      { x: 120, y: 100, ...SIZE },
      { x: 140, y: 100, ...SIZE },
    ]
    const result = resolveOverlap(candidate, others, 20)

    expect(others.some((o) => boxesOverlap(result, o))).toBe(false)
  })
})
