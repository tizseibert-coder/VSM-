import { describe, expect, it } from 'vitest'
import de from '../../../messages/de.json'
import en from '../../../messages/en.json'
import { CLASSIFICATION, classificationMarker, isClassificationValue } from './classification'

describe('classification', () => {
  it('gives every entry a short marker and a label key that both languages know', () => {
    for (const key of Object.keys(CLASSIFICATION) as (keyof typeof CLASSIFICATION)[]) {
      const entry = CLASSIFICATION[key]
      expect(entry.marker.trim().length).toBeGreaterThan(0)
      expect(entry.marker.length).toBeLessThanOrEqual(5)

      // Die ausgeschriebene Beschriftung liegt seit der Mehrsprachigkeit in
      // den Sprachdateien — der Test haelt Code und Uebersetzung zusammen,
      // damit ein umbenannter Schluessel nicht still ins Leere zeigt.
      for (const [locale, messages] of Object.entries({ de, en })) {
        const label = (messages.Classification as Record<string, string>)[entry.labelKey]
        expect(label, `${locale}: Classification.${entry.labelKey} fehlt`).toBeDefined()
        expect(label.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('isClassificationValue', () => {
  it('accepts known values', () => {
    expect(isClassificationValue('va')).toBe(true)
    expect(isClassificationValue('nva')).toBe(true)
    expect(isClassificationValue('necessary_nva')).toBe(true)
  })

  it('rejects null and unrecognized strings', () => {
    expect(isClassificationValue(null)).toBe(false)
    expect(isClassificationValue('')).toBe(false)
    expect(isClassificationValue('garbage')).toBe(false)
  })
})

describe('classificationMarker', () => {
  it('returns the short marker for a known value', () => {
    expect(classificationMarker('va')).toBe('VA')
    expect(classificationMarker('nva')).toBe('NVA')
    expect(classificationMarker('necessary_nva')).toBe('nNVA')
  })

  it('returns null for unset or unrecognized values (no badge shown)', () => {
    expect(classificationMarker(null)).toBeNull()
    expect(classificationMarker('garbage')).toBeNull()
  })
})
