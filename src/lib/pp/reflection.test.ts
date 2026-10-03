import { describe, expect, it } from 'vitest'
import { canCloseDay, reflectionScore } from './reflection'

describe('Tagesabschluss', () => {
  const allOk = { d1: { status: 'ok' as const }, d2: { status: 'ok' as const }, d3: { status: 'ok' as const }, d4: { status: 'ok' as const } }

  it('closes only with all four answers and a Kürzel', () => {
    expect(canCloseDay(allOk, 'ABC')).toEqual({ ok: true })
    expect(canCloseDay(allOk, '  ')).toEqual({ ok: false, missing: [], kuerzelMissing: true })
  })

  it('needs a comment for a deviation', () => {
    const answers = { ...allOk, d2: { status: 'warn' as const, comment: ' ' } }
    expect(reflectionScore(answers)).toBe(3)
    expect(canCloseDay(answers, 'ABC')).toEqual({ ok: false, missing: ['d2'], kuerzelMissing: false })
    expect(canCloseDay({ ...answers, d2: { status: 'warn', comment: 'Werkzeug fehlte' } }, 'ABC')).toEqual({ ok: true })
  })

  it('counts unanswered dimensions as open', () => {
    expect(reflectionScore({ d1: { status: 'ok' }, d3: { status: null } })).toBe(1)
  })
})
