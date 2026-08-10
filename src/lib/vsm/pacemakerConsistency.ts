// Methodology check: everything feeding the pacemaker (Schrittmacher) — from
// the supplier boundary up to and including the edge into the pacemaker
// itself — should be pulled (supermarket/FIFO, or an explicit 'pull'
// override), not plain push. A pacemaker only controls the schedule for
// itself; if upstream stations still push, inventory builds up uncontrolled
// right up to the one point that was supposed to be the single scheduling
// signal, defeating the point of naming a pacemaker at all.

export interface FlowEdge {
  fromProcessId: string | null
  toProcessId: string | null
  bufferType: string | null
  flowStyle: string | null
}

const PULL_COMPLIANT_BUFFER_TYPES = new Set(['supermarket', 'fifo', 'continuous'])

/**
 * Returns the edges upstream of (and into) the pacemaker that are still
 * plain push — empty if the pacemaker isn't in `chainOrder` or everything
 * upstream is already pull-compliant.
 */
export function findPushBeforePacemaker(
  chainOrder: string[],
  pacemakerId: string,
  edges: FlowEdge[]
): FlowEdge[] {
  const pacemakerIndex = chainOrder.indexOf(pacemakerId)
  if (pacemakerIndex === -1) return []

  const upstreamIds = new Set(chainOrder.slice(0, pacemakerIndex + 1))

  return edges.filter((edge) => {
    if (edge.toProcessId === null || !upstreamIds.has(edge.toProcessId)) return false
    const isPullCompliant =
      (edge.bufferType !== null && PULL_COMPLIANT_BUFFER_TYPES.has(edge.bufferType)) || edge.flowStyle === 'pull'
    return !isPullCompliant
  })
}
