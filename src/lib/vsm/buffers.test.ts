import { describe, expect, it } from 'vitest'
import { bufferGapIndices, findBuffer } from './buffers'

interface FakeBuffer {
  from_process_id: string | null
  to_process_id: string | null
  wip_count: number
}

describe('bufferGapIndices', () => {
  it('returns one more gap than there are processes', () => {
    expect(bufferGapIndices(0)).toEqual([])
    expect(bufferGapIndices(1)).toEqual([-1, 0])
    expect(bufferGapIndices(3)).toEqual([-1, 0, 1, 2])
  })
})

describe('findBuffer', () => {
  const buffers: FakeBuffer[] = [
    { from_process_id: null, to_process_id: 'p1', wip_count: 100 }, // before p1
    { from_process_id: 'p1', to_process_id: 'p2', wip_count: 200 }, // between p1/p2
    { from_process_id: 'p2', to_process_id: null, wip_count: 300 }, // after p2
  ]

  it('finds the buffer feeding the first process (from = null)', () => {
    expect(findBuffer(buffers, null, 'p1')?.wip_count).toBe(100)
  })

  it('finds the buffer between two processes', () => {
    expect(findBuffer(buffers, 'p1', 'p2')?.wip_count).toBe(200)
  })

  it('finds the buffer shipping out after the last process (to = null)', () => {
    expect(findBuffer(buffers, 'p2', null)?.wip_count).toBe(300)
  })

  it('returns undefined when no matching buffer exists yet', () => {
    expect(findBuffer(buffers, 'p2', 'p3')).toBeUndefined()
  })
})
