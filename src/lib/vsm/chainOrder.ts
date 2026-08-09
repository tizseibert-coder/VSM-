// Pure helpers for re-wiring the inventory_buffers chain when a process is
// dragged past a neighbor. The chain is a simple linear graph — one edge
// per gap, from null (supplier) through each process to null (customer) —
// so a full re-derivation from the desired left-to-right order is cheap and
// unambiguous, unlike trying to patch individual edges in place.

export interface ChainEdge {
  from: string | null
  to: string | null
}

/** The full boundary-to-boundary edge list implied by a left-to-right order. */
export function chainToEdges(order: string[]): ChainEdge[] {
  if (order.length === 0) return []
  const edges: ChainEdge[] = [{ from: null, to: order[0] }]
  for (let i = 0; i < order.length - 1; i++) {
    edges.push({ from: order[i], to: order[i + 1] })
  }
  edges.push({ from: order[order.length - 1], to: null })
  return edges
}

/**
 * Walks the buffer graph from the supplier boundary (from: null) to the
 * customer boundary (to: null) and returns the process ids in that order —
 * the canonical sequence, independent of created_at or any stored x/y.
 * Any process not reachable by walking edges (a data inconsistency) is
 * appended at the end rather than dropped, so nothing silently disappears.
 */
export function deriveChainOrder(processIds: string[], edges: ChainEdge[]): string[] {
  const nextOf = new Map<string, string | null>()
  for (const edge of edges) {
    if (edge.from !== null) nextOf.set(edge.from, edge.to)
  }

  const start = edges.find((e) => e.from === null)?.to ?? null
  const order: string[] = []
  const seen = new Set<string>()
  let current = start
  while (current !== null && !seen.has(current) && processIds.includes(current)) {
    order.push(current)
    seen.add(current)
    current = nextOf.get(current) ?? null
  }

  for (const id of processIds) {
    if (!seen.has(id)) order.push(id)
  }
  return order
}

/** Swaps a process with its immediate predecessor/successor in `order`. */
export function moveInOrder(order: string[], id: string, direction: 'earlier' | 'later'): string[] {
  const index = order.indexOf(id)
  const targetIndex = direction === 'earlier' ? index - 1 : index + 1
  if (index === -1 || targetIndex < 0 || targetIndex >= order.length) return order

  const next = [...order]
  ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
  return next
}

export interface ExistingEdge extends ChainEdge {
  id: string
}

export interface ChainReconciliation {
  /** Existing buffer ids that already match the desired order — left untouched (keeps their WIP/type). */
  unchanged: string[]
  /** Existing buffer ids to repoint to a new (from, to) pair, reusing the row instead of delete+insert. */
  repoint: { id: string; from: string | null; to: string | null }[]
}

function edgeKey(edge: ChainEdge): string {
  return `${edge.from ?? '∅'}→${edge.to ?? '∅'}`
}

/**
 * Diffs the current buffer edges against the edges implied by
 * `desiredOrder`, and reports the minimal set of rows to repoint so the
 * stored graph matches — preserving WIP/buffer_type/flow_style on rows that
 * just move to a different slot, rather than deleting and recreating them.
 */
export function reconcileChainEdges(existing: ExistingEdge[], desiredOrder: string[]): ChainReconciliation {
  const desiredEdges = chainToEdges(desiredOrder)
  const desiredKeys = new Set(desiredEdges.map(edgeKey))

  const unchanged: string[] = []
  const stale: ExistingEdge[] = []
  for (const edge of existing) {
    if (desiredKeys.has(edgeKey(edge))) {
      unchanged.push(edge.id)
    } else {
      stale.push(edge)
    }
  }

  const satisfiedKeys = new Set(existing.filter((e) => unchanged.includes(e.id)).map(edgeKey))
  const missing = desiredEdges.filter((edge) => !satisfiedKeys.has(edgeKey(edge)))

  const repoint = stale
    .slice(0, missing.length)
    .map((edge, i) => ({ id: edge.id, from: missing[i].from, to: missing[i].to }))

  return { unchanged, repoint }
}
