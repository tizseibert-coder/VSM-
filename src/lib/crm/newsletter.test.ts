import { describe, expect, it } from 'vitest'
import { isExpired } from './newsletter'

describe('isExpired', () => {
  const now = new Date('2026-09-12T12:00:00Z').getTime()

  it('behandelt fehlenden Token als abgelaufen', () => {
    expect(isExpired(null, now)).toBe(true)
  })

  it('ist nicht abgelaufen, solange die Frist noch aussteht', () => {
    expect(isExpired('2026-09-13T00:00:00Z', now)).toBe(false)
  })

  it('ist abgelaufen, sobald die Frist verstrichen ist', () => {
    expect(isExpired('2026-09-01T00:00:00Z', now)).toBe(true)
  })

  it('gilt im exakten Ablaufmoment noch als gueltig, nicht als abgelaufen', () => {
    expect(isExpired(new Date(now).toISOString(), now)).toBe(false)
  })
})
