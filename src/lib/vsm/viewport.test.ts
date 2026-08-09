import { describe, expect, it } from 'vitest'
import { MAX_SCALE, MIN_READABLE_SCALE, MIN_SCALE, clampScale, computeAutoFitScale, computeFitScale } from './viewport'

describe('clampScale', () => {
  it('leaves an in-range scale untouched', () => {
    expect(clampScale(1)).toBe(1)
  })

  it('clamps below the minimum', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE)
  })

  it('clamps above the maximum', () => {
    expect(clampScale(10)).toBe(MAX_SCALE)
  })
})

describe('computeFitScale', () => {
  it('shrinks content that is wider than the viewport', () => {
    // content twice as wide as the viewport -> scale 0.5
    const scale = computeFitScale({ width: 2000, height: 500 }, { width: 1000, height: 1000 })
    expect(scale).toBeCloseTo(0.5, 5)
  })

  it('picks the more constraining axis', () => {
    // width needs 0.5, height needs 0.25 -> the smaller wins so nothing overflows
    const scale = computeFitScale({ width: 1000, height: 2000 }, { width: 500, height: 500 })
    expect(scale).toBeCloseTo(0.25, 5)
  })

  it('never scales a small diagram above 100%', () => {
    const scale = computeFitScale({ width: 200, height: 100 }, { width: 2000, height: 2000 })
    expect(scale).toBe(1)
  })

  it('accounts for padding on both sides', () => {
    // 1000-wide content into a 1100-wide viewport with 50px padding each
    // side leaves exactly 1000px available -> scale 1 (not slightly above)
    const scale = computeFitScale({ width: 1000, height: 500 }, { width: 1100, height: 700 }, 50)
    expect(scale).toBe(1)
  })

  it('returns 1 for zero-size content', () => {
    expect(computeFitScale({ width: 0, height: 0 }, { width: 900, height: 500 })).toBe(1)
  })
})

describe('computeAutoFitScale', () => {
  it('matches computeFitScale when the diagram comfortably fits', () => {
    const content = { width: 800, height: 400 }
    const viewport = { width: 1000, height: 1000 }
    expect(computeAutoFitScale(content, viewport)).toBe(computeFitScale(content, viewport))
  })

  it('never drops below the readable floor, even for a huge diagram', () => {
    const scale = computeAutoFitScale({ width: 6000, height: 2000 }, { width: 900, height: 500 })
    expect(scale).toBe(MIN_READABLE_SCALE)
  })
})
