import { describe, expect, it } from 'vitest'
import { deriveFutureStateQuestions, type FutureStateInput, type FutureStateProcessInput } from './futureStateQuestions'

const process = (overrides: Partial<FutureStateProcessInput> & { id: string }): FutureStateProcessInput => ({
  name: overrides.id,
  cycleTime: 5,
  operatorCount: 1,
  isPacemaker: false,
  hasHeijunka: false,
  kaizenNote: null,
  ...overrides,
})

const baseInput = (overrides: Partial<FutureStateInput> = {}): FutureStateInput => ({
  processes: [],
  buffers: [],
  annualThroughput: null,
  availableMinutesPerDay: 480,
  pitchMinutes: null,
  ...overrides,
})

describe('deriveFutureStateQuestions', () => {
  it('returns exactly the 8 questions, in order, each with a German question text', () => {
    const result = deriveFutureStateQuestions(baseInput())
    expect(result.map((q) => q.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const q of result) {
      expect(q.question.length).toBeGreaterThan(0)
      expect(['answered', 'open', 'not_applicable']).toContain(q.status)
    }
  })

  describe('Q1 — Taktzeit', () => {
    it('is open when annual throughput is not set', () => {
      const [q1] = deriveFutureStateQuestions(baseInput())
      expect(q1.status).toBe('open')
    })

    it('is answered once annual throughput yields a takt time', () => {
      const [q1] = deriveFutureStateQuestions(baseInput({ annualThroughput: 50000 }))
      expect(q1.status).toBe('answered')
      expect(q1.summary).toMatch(/Taktzeit/)
    })
  })

  describe('Q2 — Build-to-order vs. Fertigwarenlager', () => {
    it('is not_applicable when no processes exist yet', () => {
      const [, q2] = deriveFutureStateQuestions(baseInput())
      expect(q2.status).toBe('not_applicable')
    })

    it('is answered when the terminal buffer is a zero-WIP standard edge (direct ship)', () => {
      const input = baseInput({
        processes: [process({ id: 'A' })],
        buffers: [{ fromProcessId: 'A', toProcessId: null, wipCount: 0, bufferType: 'standard', flowStyle: null }],
      })
      const [, q2] = deriveFutureStateQuestions(input)
      expect(q2.status).toBe('answered')
      expect(q2.summary).toMatch(/Direktversand/)
    })

    it('is answered when the terminal buffer is an explicit finished-goods supermarket', () => {
      const input = baseInput({
        processes: [process({ id: 'A' })],
        buffers: [{ fromProcessId: 'A', toProcessId: null, wipCount: 120, bufferType: 'supermarket', flowStyle: null }],
      })
      const [, q2] = deriveFutureStateQuestions(input)
      expect(q2.status).toBe('answered')
      expect(q2.summary).toMatch(/Supermarkt/)
    })

    it('is open when stock sits at the terminal buffer without an explicit type decision', () => {
      const input = baseInput({
        processes: [process({ id: 'A' })],
        buffers: [{ fromProcessId: 'A', toProcessId: null, wipCount: 80, bufferType: 'standard', flowStyle: null }],
      })
      const [, q2] = deriveFutureStateQuestions(input)
      expect(q2.status).toBe('open')
    })
  })

  describe('Q3 — Continuous Flow', () => {
    it('is not_applicable with fewer than 2 processes', () => {
      const [, , q3] = deriveFutureStateQuestions(baseInput({ processes: [process({ id: 'A' })] }))
      expect(q3.status).toBe('not_applicable')
    })

    it('is open when no internal connection runs as continuous flow', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B' })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 10, bufferType: 'standard', flowStyle: null }],
      })
      const [, , q3] = deriveFutureStateQuestions(input)
      expect(q3.status).toBe('open')
    })

    it('is answered once at least one internal connection is continuous flow', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B' })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 0, bufferType: 'continuous', flowStyle: null }],
      })
      const [, , q3] = deriveFutureStateQuestions(input)
      expect(q3.status).toBe('answered')
      expect(q3.summary).toMatch(/1 von 1/)
    })
  })

  describe('Q4 — Pull/Supermärkte', () => {
    it('is not_applicable with fewer than 2 processes', () => {
      const [, , , q4] = deriveFutureStateQuestions(baseInput({ processes: [process({ id: 'A' })] }))
      expect(q4.status).toBe('not_applicable')
    })

    it('is open when a non-continuous internal connection still runs push', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B' })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 10, bufferType: 'standard', flowStyle: null }],
      })
      const [, , , q4] = deriveFutureStateQuestions(input)
      expect(q4.status).toBe('open')
    })

    it('is answered when every non-continuous internal connection is supermarket/fifo', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B' })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 10, bufferType: 'supermarket', flowStyle: null }],
      })
      const [, , , q4] = deriveFutureStateQuestions(input)
      expect(q4.status).toBe('answered')
    })

    it('is answered when every internal connection is already continuous flow (nothing left to pull)', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B' })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 0, bufferType: 'continuous', flowStyle: null }],
      })
      const [, , , q4] = deriveFutureStateQuestions(input)
      expect(q4.status).toBe('answered')
    })
  })

  describe('Q5 — Schrittmacher', () => {
    it('is not_applicable when there are no processes', () => {
      const [, , , , q5] = deriveFutureStateQuestions(baseInput())
      expect(q5.status).toBe('not_applicable')
    })

    it('is open when no process is marked as pacemaker', () => {
      const [, , , , q5] = deriveFutureStateQuestions(baseInput({ processes: [process({ id: 'A' })] }))
      expect(q5.status).toBe('open')
    })

    it('is open when the pacemaker is set but push edges remain upstream of it', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B', isPacemaker: true })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 10, bufferType: 'standard', flowStyle: null }],
      })
      const [, , , , q5] = deriveFutureStateQuestions(input)
      expect(q5.status).toBe('open')
    })

    it('is answered when the pacemaker is set and everything upstream is pull-compliant', () => {
      const input = baseInput({
        processes: [process({ id: 'A' }), process({ id: 'B', isPacemaker: true })],
        buffers: [{ fromProcessId: 'A', toProcessId: 'B', wipCount: 10, bufferType: 'supermarket', flowStyle: null }],
      })
      const [, , , , q5] = deriveFutureStateQuestions(input)
      expect(q5.status).toBe('answered')
    })
  })

  describe('Q6 — Heijunka', () => {
    it('is not_applicable when no pacemaker is set yet', () => {
      const [, , , , , q6] = deriveFutureStateQuestions(baseInput({ processes: [process({ id: 'A' })] }))
      expect(q6.status).toBe('not_applicable')
    })

    it('is open when the pacemaker has no heijunka box', () => {
      const input = baseInput({ processes: [process({ id: 'A', isPacemaker: true, hasHeijunka: false })] })
      const [, , , , , q6] = deriveFutureStateQuestions(input)
      expect(q6.status).toBe('open')
    })

    it('is answered when the pacemaker has a heijunka box', () => {
      const input = baseInput({ processes: [process({ id: 'A', isPacemaker: true, hasHeijunka: true })] })
      const [, , , , , q6] = deriveFutureStateQuestions(input)
      expect(q6.status).toBe('answered')
    })
  })

  describe('Q7 — Pitch', () => {
    it('is not_applicable when takt time is unknown', () => {
      const [, , , , , , q7] = deriveFutureStateQuestions(baseInput())
      expect(q7.status).toBe('not_applicable')
    })

    it('is open when takt time is known but no pitch is set', () => {
      const [, , , , , , q7] = deriveFutureStateQuestions(baseInput({ annualThroughput: 50000 }))
      expect(q7.status).toBe('open')
    })

    it('is answered once a pitch is set', () => {
      const [, , , , , , q7] = deriveFutureStateQuestions(baseInput({ annualThroughput: 50000, pitchMinutes: 30 }))
      expect(q7.status).toBe('answered')
    })
  })

  describe('Q8 — Kaizen', () => {
    it('is not_applicable with no processes', () => {
      const [, , , , , , , q8] = deriveFutureStateQuestions(baseInput())
      expect(q8.status).toBe('not_applicable')
    })

    it('is open when no process has a kaizen note', () => {
      const [, , , , , , , q8] = deriveFutureStateQuestions(baseInput({ processes: [process({ id: 'A' })] }))
      expect(q8.status).toBe('open')
    })

    it('is answered once at least one process has a non-blank kaizen note', () => {
      const input = baseInput({ processes: [process({ id: 'A', kaizenNote: 'Rüstzeit halbieren' })] })
      const [, , , , , , , q8] = deriveFutureStateQuestions(input)
      expect(q8.status).toBe('answered')
      expect(q8.summary).toMatch(/1/)
    })

    it('treats a whitespace-only kaizen note as unset', () => {
      const input = baseInput({ processes: [process({ id: 'A', kaizenNote: '   ' })] })
      const [, , , , , , , q8] = deriveFutureStateQuestions(input)
      expect(q8.status).toBe('open')
    })
  })
})
