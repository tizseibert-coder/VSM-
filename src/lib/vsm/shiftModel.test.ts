import { describe, expect, it } from 'vitest'
import { deriveAvailableMinutes, hasShiftModel, shiftModelDeviation } from './shiftModel'

describe('deriveAvailableMinutes', () => {
  it('multiplies the shifts by their net time', () => {
    expect(deriveAvailableMinutes({ shiftCount: 2, netMinutesPerShift: 450 })).toBe(900)
  })

  it('handles a single shift', () => {
    expect(deriveAvailableMinutes({ shiftCount: 1, netMinutesPerShift: 480 })).toBe(480)
  })

  // Unbekannt ist nicht null Minuten: Eine 0 setzte die Taktzeit auf null und
  // machte jede Kennzahl darueber unbrauchbar.
  it('stays unknown while either figure is missing', () => {
    expect(deriveAvailableMinutes({ shiftCount: null, netMinutesPerShift: 450 })).toBeNull()
    expect(deriveAvailableMinutes({ shiftCount: 2, netMinutesPerShift: null })).toBeNull()
    expect(deriveAvailableMinutes({ shiftCount: null, netMinutesPerShift: null })).toBeNull()
  })

  it('treats zero and negative figures as not given', () => {
    expect(deriveAvailableMinutes({ shiftCount: 0, netMinutesPerShift: 450 })).toBeNull()
    expect(deriveAvailableMinutes({ shiftCount: 2, netMinutesPerShift: -450 })).toBeNull()
  })
})

describe('hasShiftModel', () => {
  it('needs both figures', () => {
    expect(hasShiftModel({ shiftCount: 2, netMinutesPerShift: 450 })).toBe(true)
    expect(hasShiftModel({ shiftCount: 2, netMinutesPerShift: null })).toBe(false)
  })
})

describe('shiftModelDeviation', () => {
  it('reports what the model would give when the stored value differs', () => {
    expect(shiftModelDeviation(840, { shiftCount: 2, netMinutesPerShift: 450 })).toBe(900)
  })

  it('is silent when the stored value matches the model', () => {
    expect(shiftModelDeviation(900, { shiftCount: 2, netMinutesPerShift: 450 })).toBeNull()
  })

  // Sonst loeste eine Nettozeit von 449,999 einen Hinweis aus, den niemand
  // nachvollziehen kann.
  it('ignores differences below a whole minute', () => {
    expect(shiftModelDeviation(900, { shiftCount: 2, netMinutesPerShift: 449.9999 })).toBeNull()
  })

  it('is silent without a complete model', () => {
    expect(shiftModelDeviation(840, { shiftCount: null, netMinutesPerShift: 450 })).toBeNull()
  })
})
