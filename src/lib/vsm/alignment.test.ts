import { describe, expect, it } from 'vitest'
import { snapToAlignment } from './alignment'

describe('snapToAlignment', () => {
  it('snaps the y axis when within the threshold of a target', () => {
    const result = snapToAlignment({ x: 300, y: 103 }, [{ x: 100, y: 100 }])
    expect(result.y).toBe(100)
    expect(result.guideY).toBe(100)
  })

  it('does not snap when outside the threshold', () => {
    const result = snapToAlignment({ x: 300, y: 130 }, [{ x: 100, y: 100 }], 6)
    expect(result.y).toBe(130)
    expect(result.guideY).toBeNull()
  })

  it('snaps x and y independently', () => {
    const result = snapToAlignment({ x: 202, y: 500 }, [{ x: 200, y: 100 }])
    expect(result.x).toBe(200)
    expect(result.guideX).toBe(200)
    expect(result.y).toBe(500)
    expect(result.guideY).toBeNull()
  })

  it('returns the original point untouched when there are no targets', () => {
    const result = snapToAlignment({ x: 42, y: 17 }, [])
    expect(result).toEqual({ x: 42, y: 17, guideX: null, guideY: null })
  })

  it('snaps to the first matching target when multiple are in range', () => {
    const result = snapToAlignment({ x: 0, y: 101 }, [{ x: 0, y: 100 }, { x: 0, y: 104 }])
    expect(result.y).toBe(100)
  })
})
