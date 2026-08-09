import { describe, expect, it } from 'vitest'
import { splitSegmentAroundGap, zigzagPoints } from './geometry'

describe('splitSegmentAroundGap', () => {
  it('splits a horizontal segment symmetrically around its midpoint', () => {
    const { near, far } = splitSegmentAroundGap({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(near).toEqual({ x: 40, y: 0 })
    expect(far).toEqual({ x: 60, y: 0 })
  })

  it('splits a vertical segment symmetrically around its midpoint', () => {
    const { near, far } = splitSegmentAroundGap({ x: 0, y: 0 }, { x: 0, y: 100 }, 10)
    expect(near.x).toBeCloseTo(0)
    expect(near.y).toBeCloseTo(40)
    expect(far.y).toBeCloseTo(60)
  })

  it('handles a diagonal segment', () => {
    const { near, far } = splitSegmentAroundGap({ x: 0, y: 0 }, { x: 30, y: 40 }, 5)
    // length = 50, unit vector = (0.6, 0.8), midpoint = (15,20)
    expect(near.x).toBeCloseTo(12)
    expect(near.y).toBeCloseTo(16)
    expect(far.x).toBeCloseTo(18)
    expect(far.y).toBeCloseTo(24)
  })

  it('does not crash on a zero-length segment', () => {
    const { near, far } = splitSegmentAroundGap({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)
    expect(near).toEqual({ x: 5, y: 5 })
    expect(far).toEqual({ x: 5, y: 5 })
  })
})

describe('zigzagPoints', () => {
  it('starts and ends at the given points', () => {
    const pts = zigzagPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(pts[0]).toBe(0)
    expect(pts[1]).toBe(0)
    expect(pts[pts.length - 2]).toBe(100)
    expect(pts[pts.length - 1]).toBe(0)
  })

  it('produces 4 waypoints (8 numbers)', () => {
    const pts = zigzagPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(pts).toHaveLength(8)
  })

  it('deviates from a straight line by the given amplitude', () => {
    const pts = zigzagPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    // for a horizontal line, the perpendicular is vertical -> y should move by ~amplitude
    expect(Math.abs(pts[3])).toBeCloseTo(10)
    expect(Math.abs(pts[5])).toBeCloseTo(10)
  })

  it('does not crash on a zero-length segment', () => {
    const pts = zigzagPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)
    expect(pts).toEqual([5, 5, 5, 5])
  })
})
