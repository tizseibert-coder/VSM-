import { describe, expect, it } from 'vitest'
import { GLOSSARY, getGlossaryEntry, type GlossaryKey } from './glossary'

describe('glossary', () => {
  it('gives every entry a non-empty term and definition', () => {
    for (const key of Object.keys(GLOSSARY) as GlossaryKey[]) {
      const entry = GLOSSARY[key]
      expect(entry.term.trim().length).toBeGreaterThan(0)
      expect(entry.definition.trim().length).toBeGreaterThan(0)
    }
  })

  it('getGlossaryEntry returns the matching entry for a known key', () => {
    expect(getGlossaryEntry('taktTime')).toEqual({
      term: 'Taktzeit',
      definition:
        'Verfügbare Produktionszeit geteilt durch den Kundenbedarf. Das Tempo, in dem ein Stück fertig werden muss, damit die Nachfrage gedeckt wird — kein Bearbeitungswert, sondern eine Vorgabe.',
    })
  })

  it('covers the KPI-bar terms', () => {
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['leadTime', 'cycleTimeSum', 'pce', 'taktTime']),
    )
  })

  it('covers the process-panel terms', () => {
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['processCycleTime', 'changeoverTime', 'oee', 'operatorCount', 'pacemaker']),
    )
  })

  it('covers the buffer-panel terms', () => {
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['wip', 'bufferType', 'flowStyle', 'kanbanType']),
    )
  })

  it('covers the exit-rate / available-production-time terms', () => {
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['availableMinutesPerDay', 'exitRate']),
    )
  })

  it('covers the future-state-wizard terms (questions 6-8)', () => {
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['heijunka', 'pitch', 'kaizenBlitz']),
    )
  })
})
