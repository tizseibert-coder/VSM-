import { describe, expect, it } from 'vitest'
import de from '../../../messages/de.json'
import en from '../../../messages/en.json'
import { GLOSSARY_KEYS, type GlossaryKey } from './glossary'

// Die Texte liegen seit der Mehrsprachigkeit in messages/{de,en}.json, nicht
// mehr im Modul. Der Test prueft deshalb jetzt beide Sprachen gegen dieselbe
// Schluesselliste — das faengt zusaetzlich den Fall ab, der vorher gar nicht
// auffallen konnte: ein Begriff, den nur eine der beiden Sprachen kennt.
const LOCALES = { de, en } as const

describe('glossary', () => {
  it('gives every entry a non-empty term and definition, in every language', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of GLOSSARY_KEYS) {
        // Der Namensraum enthaelt neben den Begriffen auch `tooltipAria`
        // (eine flache Zeichenkette), deshalb der Umweg ueber `unknown`.
        const entry = (messages.Glossary as unknown as Record<
          string,
          { term: string; definition: string }
        >)[key]
        expect(entry, `${locale}: Glossary.${key} fehlt`).toBeDefined()
        expect(entry.term.trim().length, `${locale}: Glossary.${key}.term ist leer`).toBeGreaterThan(0)
        expect(
          entry.definition.trim().length,
          `${locale}: Glossary.${key}.definition ist leer`
        ).toBeGreaterThan(0)
      }
    }
  })

  it('has no orphaned translations without a key in the list', () => {
    const known = new Set<string>([...GLOSSARY_KEYS, 'tooltipAria'])
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of Object.keys(messages.Glossary)) {
        expect(known.has(key), `${locale}: Glossary.${key} gehoert zu keinem bekannten Begriff`).toBe(
          true
        )
      }
    }
  })

  it('resolves a known term in both languages', () => {
    expect(de.Glossary.taktTime.term).toBe('Taktzeit')
    expect(en.Glossary.taktTime.term).toBe('Takt time')
  })

  function covers(...keys: GlossaryKey[]) {
    expect(GLOSSARY_KEYS).toEqual(expect.arrayContaining(keys))
  }

  it('covers the KPI-bar terms', () => {
    covers('leadTime', 'cycleTimeSum', 'pce', 'taktTime')
  })

  it('covers the process-panel terms', () => {
    covers('processCycleTime', 'changeoverTime', 'oee', 'operatorCount', 'pacemaker')
  })

  it('covers the buffer-panel terms', () => {
    covers('wip', 'bufferType', 'flowStyle', 'kanbanType')
  })

  it('covers the exit-rate / available-production-time terms', () => {
    covers('availableMinutesPerDay', 'exitRate')
  })

  it('covers the future-state-wizard terms (questions 6-8)', () => {
    covers('heijunka', 'pitch', 'kaizenBlitz')
  })
})
