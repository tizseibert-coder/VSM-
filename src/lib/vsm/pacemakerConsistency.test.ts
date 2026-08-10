import { describe, expect, it } from 'vitest'
import { findPushBeforePacemaker, type FlowEdge } from './pacemakerConsistency'

const push = (from: string | null, to: string | null): FlowEdge => ({
  fromProcessId: from,
  toProcessId: to,
  bufferType: 'standard',
  flowStyle: null,
})
const supermarket = (from: string | null, to: string | null): FlowEdge => ({
  fromProcessId: from,
  toProcessId: to,
  bufferType: 'supermarket',
  flowStyle: null,
})

describe('findPushBeforePacemaker', () => {
  it('returns nothing when every edge upstream of the pacemaker is a supermarket', () => {
    const chainOrder = ['A', 'B', 'C']
    const edges = [supermarket(null, 'A'), supermarket('A', 'B'), push('B', 'C')]
    expect(findPushBeforePacemaker(chainOrder, 'B', edges)).toEqual([])
  })

  it('flags a plain push edge feeding into the pacemaker', () => {
    const chainOrder = ['A', 'B', 'C']
    const edges = [supermarket(null, 'A'), push('A', 'B'), push('B', 'C')]
    const result = findPushBeforePacemaker(chainOrder, 'B', edges)
    expect(result).toEqual([push('A', 'B')])
  })

  it('flags an unpulled supplier boundary edge when the pacemaker is not the first process', () => {
    const chainOrder = ['A', 'B']
    const edges = [push(null, 'A'), supermarket('A', 'B')]
    const result = findPushBeforePacemaker(chainOrder, 'B', edges)
    expect(result).toEqual([push(null, 'A')])
  })

  it('ignores edges downstream of the pacemaker', () => {
    const chainOrder = ['A', 'B', 'C']
    const edges = [supermarket(null, 'A'), supermarket('A', 'B'), push('B', 'C')]
    // B is the pacemaker; the push edge B->C is downstream, not flagged
    expect(findPushBeforePacemaker(chainOrder, 'B', edges)).toEqual([])
  })

  it('treats an explicit pull flow_style override as compliant even on a standard buffer', () => {
    const chainOrder = ['A', 'B']
    const edges = [{ fromProcessId: null, toProcessId: 'A', bufferType: 'standard', flowStyle: 'pull' }]
    expect(findPushBeforePacemaker(chainOrder, 'A', edges)).toEqual([])
  })

  it('treats continuous (one-piece flow) as compliant', () => {
    const chainOrder = ['A', 'B']
    const edges = [{ fromProcessId: 'A', toProcessId: 'B', bufferType: 'continuous', flowStyle: null }]
    expect(findPushBeforePacemaker(chainOrder, 'B', edges)).toEqual([])
  })

  it('returns an empty array when the pacemaker id is not in the chain', () => {
    expect(findPushBeforePacemaker(['A', 'B'], 'ghost', [push(null, 'A')])).toEqual([])
  })

  it('when the pacemaker is the very first process, only the supplier edge is checked', () => {
    const chainOrder = ['A', 'B']
    const edges = [supermarket(null, 'A'), push('A', 'B')]
    expect(findPushBeforePacemaker(chainOrder, 'A', edges)).toEqual([])
  })
})
