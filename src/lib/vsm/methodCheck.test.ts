import { describe, expect, it } from 'vitest'
import { formatFindingCount, rankFindings, type MethodFinding } from './methodCheck'

const befund = (id: string, severity: MethodFinding['severity']): MethodFinding => ({
  id,
  severity,
  title: id,
  detail: null,
})

describe('formatFindingCount', () => {
  it('uses the singular for exactly one finding', () => {
    expect(formatFindingCount(1)).toBe('1 Hinweis')
  })

  it('uses the plural for more than one', () => {
    expect(formatFindingCount(3)).toBe('3 Hinweise')
  })

  it('uses the plural for none', () => {
    expect(formatFindingCount(0)).toBe('0 Hinweise')
  })
})

describe('rankFindings', () => {
  it('puts findings that invalidate a KPI first', () => {
    const ranked = rankFindings([
      befund('a', 'warning'),
      befund('b', 'critical'),
      befund('c', 'warning'),
    ])
    expect(ranked.map((f) => f.id)).toEqual(['b', 'a', 'c'])
  })

  // Innerhalb einer Stufe ist die Reihenfolge die der Erzeugung — sonst
  // wanderten Hinweise bei jeder Neuberechnung, obwohl sich nichts geaendert
  // hat, und man verliert beim Lesen die Stelle.
  it('keeps the original order within one severity', () => {
    const ranked = rankFindings([befund('a', 'warning'), befund('b', 'warning')])
    expect(ranked.map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [befund('a', 'warning'), befund('b', 'critical')]
    rankFindings(input)
    expect(input.map((f) => f.id)).toEqual(['a', 'b'])
  })
})
