import { describe, expect, it } from 'vitest'
import { chainToEdges, deriveChainOrder, reconcileChainEdges, wouldCreateCycle } from './chainOrder'

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

describe('deriveChainOrder', () => {
  it('walks a simple linear chain from the supplier boundary to the customer boundary', () => {
    const edges = [
      { from: null, to: 'A' },
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: null },
    ]
    expect(deriveChainOrder(['A', 'B', 'C'], edges)).toEqual(['A', 'B', 'C'])
  })

  it('appends a process unreachable from the boundary walk (data inconsistency) instead of dropping it', () => {
    const edges = [
      { from: null, to: 'A' },
      { from: 'A', to: null },
    ]
    // 'B' has no edges at all — still must show up somewhere, not vanish.
    expect(deriveChainOrder(['A', 'B'], edges)).toEqual(['A', 'B'])
  })

  it('merge (two predecessors into one process): both incoming edges are distinct map keys, no collision', () => {
    // A -> C, B -> C, C -> null : both A and B lead into C without either
    // edge overwriting the other (they're keyed by their own `from`, not by
    // the shared `to`).
    const edges = [
      { from: null, to: 'A' },
      { from: null, to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
      { from: 'C', to: null },
    ]
    const order = deriveChainOrder(['A', 'B', 'C'], edges)
    expect(order).toContain('A')
    expect(order).toContain('B')
    expect(order).toContain('C')
    // C can only be walked to once, from whichever boundary edge is visited
    // first — either A or B ends up right before it, the other is appended.
    expect(order.indexOf('C')).toBeGreaterThan(-1)
  })

  it('split (two successors from one process): picks a deterministic primary edge instead of silently depending on array order', () => {
    // A splits to B and to Z. Whichever of B/Z sorts first lexicographically
    // becomes the primary walk target; the other is still included (appended),
    // just not positioned as reachable-from-A in this pass — see chainOrder.ts.
    const edgesOneOrder = [
      { from: null, to: 'A' },
      { from: 'A', to: 'Z' },
      { from: 'A', to: 'B' },
    ]
    const edgesReversed = [
      { from: null, to: 'A' },
      { from: 'A', to: 'B' },
      { from: 'A', to: 'Z' },
    ]
    // Same edge set, different input order -> same result. This is the
    // concrete regression the fix targets: order-dependence on re-fetch.
    expect(deriveChainOrder(['A', 'B', 'Z'], edgesOneOrder)).toEqual(
      deriveChainOrder(['A', 'B', 'Z'], edgesReversed)
    )
    const order = deriveChainOrder(['A', 'B', 'Z'], edgesOneOrder)
    expect(order).toContain('B')
    expect(order).toContain('Z')
  })

  it('prefers continuing into a real process over stopping at the customer boundary when a process has both', () => {
    // A ships partly to the customer (to: null) and partly continues to B.
    // The forward walk should keep going into B rather than terminating.
    const edges = [
      { from: null, to: 'A' },
      { from: 'A', to: null },
      { from: 'A', to: 'B' },
    ]
    expect(deriveChainOrder(['A', 'B'], edges)).toEqual(['A', 'B'])
  })
})

describe('wouldCreateCycle', () => {
  it('flags a self-loop', () => {
    expect(wouldCreateCycle([], 'A', 'A')).toBe(true)
  })

  it('flags a direct back-edge (B already leads to A, so A->B would close a loop)', () => {
    const edges = [{ from: 'B', to: 'A' }]
    expect(wouldCreateCycle(edges, 'A', 'B')).toBe(true)
  })

  it('flags an indirect cycle through multiple hops', () => {
    // A -> B -> C already exists; C -> A would close the loop.
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ]
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true)
  })

  it('allows a normal forward connection that does not close any loop', () => {
    const edges = [{ from: 'A', to: 'B' }]
    expect(wouldCreateCycle(edges, 'B', 'C')).toBe(false)
  })

  it('allows a second, independent predecessor (merge) that does not close a loop', () => {
    const edges = [{ from: 'A', to: 'C' }]
    expect(wouldCreateCycle(edges, 'B', 'C')).toBe(false)
  })

  it('ignores boundary (null) edges when checking reachability', () => {
    const edges = [
      { from: null, to: 'A' },
      { from: 'A', to: null },
    ]
    expect(wouldCreateCycle(edges, 'B', 'A')).toBe(false)
  })
})
