import { describe, expect, it } from 'vitest'
import de from '../../../messages/de.json'
import en from '../../../messages/en.json'
import { rankFindings, type MethodFinding } from './methodCheck'

const befund = (id: string, severity: MethodFinding['severity']): MethodFinding => ({
  id,
  severity,
  title: id,
  detail: null,
})

// formatFindingCount() stand frueher hier und bildete "1 Hinweis" /
// "3 Hinweise" selbst. Das kann eine feste Funktion nicht fuer jede Sprache
// leisten — Pluralregeln sind nicht ueberall zweiteilig. Die ICU-Regel in
// MethodCheck.hintCount hat das uebernommen; der Test haelt fest, dass beide
// Sprachen eine mitbringen und beide Faelle abdecken.
describe('hint count message', () => {
  it('defines a plural rule with a singular and a plural branch', () => {
    for (const [locale, messages] of Object.entries({ de, en })) {
      const rule = messages.MethodCheck.hintCount
      expect(rule, locale + ': MethodCheck.hintCount fehlt').toBeDefined()
      expect(rule).toContain('plural')
      expect(rule, locale + ': keine Einzahl-Form').toMatch(/\bone\s*\{/)
      expect(rule, locale + ': keine Mehrzahl-Form').toMatch(/\bother\s*\{/)
    }
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
