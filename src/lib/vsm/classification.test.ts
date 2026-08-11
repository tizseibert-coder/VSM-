import { describe, expect, it } from 'vitest'
import { CLASSIFICATION, classificationMarker, isClassificationValue } from './classification'

describe('classification', () => {
  it('gives every entry a non-empty label and a short marker', () => {
    for (const key of Object.keys(CLASSIFICATION) as (keyof typeof CLASSIFICATION)[]) {
      const entry = CLASSIFICATION[key]
      expect(entry.label.trim().length).toBeGreaterThan(0)
      expect(entry.marker.trim().length).toBeGreaterThan(0)
      expect(entry.marker.length).toBeLessThanOrEqual(5)
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
