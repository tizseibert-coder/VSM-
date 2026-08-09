import { describe, expect, it } from 'vitest'
import { chainToEdges, reconcileChainEdges } from './chainOrder'

describe('chainToEdges', () => {
  it('returns an empty list for no processes', () => {
    expect(chainToEdges([])).toEqual([])
  })

  it('wraps a single process with both boundary edges', () => {
    expect(chainToEdges(['A'])).toEqual([
      { from: null, to: 'A' },
      { from: 'A', to: null },
    ])
  })

  it('chains multiple processes in order', () => {
    expect(chainToEdges(['A', 'B', 'C'])).toEqual([
      { from: null, to: 'A' },
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: null },
    ])
  })
})

describe('reconcileChainEdges', () => {
  it('reports every edge as unchanged when the order already matches', () => {
    const existing = [
      { id: '1', from: null, to: 'A' },
      { id: '2', from: 'A', to: 'B' },
      { id: '3', from: 'B', to: null },
    ]
    const result = reconcileChainEdges(existing, ['A', 'B'])
    expect(result.unchanged.sort()).toEqual(['1', '2', '3'])
    expect(result.repoint).toEqual([])
  })

  it('repoints only the edges that actually changed when C moves to the front', () => {
    // old: null->A->B->C->null, new order: C, A, B
    // (A->B survives unchanged; null->A, B->C, C->null must be repointed)
    const existing = [
      { id: 'e1', from: null, to: 'A' },
      { id: 'e2', from: 'A', to: 'B' },
      { id: 'e3', from: 'B', to: 'C' },
      { id: 'e4', from: 'C', to: null },
    ]
    const result = reconcileChainEdges(existing, ['C', 'A', 'B'])

    expect(result.unchanged).toEqual(['e2'])
    expect(result.repoint).toHaveLength(3)

    // Applying the repoints should reproduce exactly the desired edge set.
    const finalEdges = new Set(
      [
        ...existing.filter((e) => result.unchanged.includes(e.id)).map((e) => `${e.from}→${e.to}`),
        ...result.repoint.map((r) => `${r.from}→${r.to}`),
      ]
    )
    expect(finalEdges).toEqual(new Set(['null→C', 'C→A', 'A→B', 'B→null']))
  })

  it('is a no-op for an already-empty chain and empty desired order', () => {
    const result = reconcileChainEdges([], [])
    expect(result).toEqual({ unchanged: [], repoint: [] })
  })
})
