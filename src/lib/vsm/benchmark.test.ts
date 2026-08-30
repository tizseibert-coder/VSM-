import { describe, expect, it } from 'vitest'
import { classifyBenchmark, type BenchmarkRef } from './benchmark'

// Real percentiles: p25 <= median <= p75, always. Which end is *good* is the
// metric's business, not the distribution's — that is what higherIsBetter is
// for. Storing them the other way round (as this project did for cycle time)
// produces the impossible "P25 3.4 · Median 2.2 · P75 1.5" in the UI.
const timeRef: BenchmarkRef = { p25: 1.5, median: 2.2, p75: 3.4 } // lower is better
const oeeRef: BenchmarkRef = { p25: 74, median: 79, p75: 84 } // higher is better

describe('classifyBenchmark — lower-is-better metric (e.g. cycle time)', () => {
  it('classifies a value at or below p25 as top tier', () => {
    expect(classifyBenchmark(1.5, timeRef, false)).toBe('top')
    expect(classifyBenchmark(1.0, timeRef, false)).toBe('top')
  })

  it('classifies a value between p25 and median as good', () => {
    expect(classifyBenchmark(2.0, timeRef, false)).toBe('good')
    expect(classifyBenchmark(2.2, timeRef, false)).toBe('good')
  })

  it('classifies a value between median and p75 as average', () => {
    expect(classifyBenchmark(3.0, timeRef, false)).toBe('average')
    expect(classifyBenchmark(3.4, timeRef, false)).toBe('average')
  })

  it('classifies a value worse than p75 as below', () => {
    expect(classifyBenchmark(4.0, timeRef, false)).toBe('below')
  })

  it('never rates a larger value better than a smaller one', () => {
    const order = ['top', 'good', 'average', 'below']
    const tiers = [1.0, 2.0, 3.0, 4.0].map((v) => order.indexOf(classifyBenchmark(v, timeRef, false)))

    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
  })

  it('keeps the example project on the same tier as before the percentile fix', () => {
    // Average cycle time of the seeded example line is 2.825 min — it was
    // shown as "Durchschnitt" with the inverted data and must stay there now
    // that the data and the logic are both right.
    expect(classifyBenchmark(2.825, timeRef, false)).toBe('average')
  })
})

describe('classifyBenchmark — higher-is-better metric (e.g. OEE)', () => {
  it('classifies a value at or above p75 as top tier', () => {
    expect(classifyBenchmark(84, oeeRef, true)).toBe('top')
    expect(classifyBenchmark(90, oeeRef, true)).toBe('top')
  })

  it('classifies a value between median and p75 as good', () => {
    expect(classifyBenchmark(80, oeeRef, true)).toBe('good')
  })

  it('classifies a value between p25 and median as average', () => {
    expect(classifyBenchmark(76, oeeRef, true)).toBe('average')
  })

  it('classifies a value below p25 as below', () => {
    expect(classifyBenchmark(60, oeeRef, true)).toBe('below')
  })

  it('never rates a smaller value better than a larger one', () => {
    const order = ['top', 'good', 'average', 'below']
    const tiers = [90, 80, 76, 60].map((v) => order.indexOf(classifyBenchmark(v, oeeRef, true)))

    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
  })

  it('keeps the example project on the same tier as before the percentile fix', () => {
    expect(classifyBenchmark(83.75, oeeRef, true)).toBe('good')
  })
})

describe('classifyBenchmark — the two directions are mirror images', () => {
  it('rates each end of the distribution top in its own direction', () => {
    expect(classifyBenchmark(timeRef.p25, timeRef, false)).toBe('top')
    expect(classifyBenchmark(timeRef.p75, timeRef, true)).toBe('top')
  })

  it('rates the same endpoint merely average in the opposite direction', () => {
    // Both boundaries are inclusive, so an endpoint still sits inside the
    // average band when read from the other side — 'below' is reserved for
    // values strictly outside the quartile range.
    expect(classifyBenchmark(timeRef.p25, timeRef, true)).toBe('average')
    expect(classifyBenchmark(timeRef.p75, timeRef, false)).toBe('average')
  })

  it('rates values strictly outside the quartile range as below', () => {
    expect(classifyBenchmark(timeRef.p25 - 0.1, timeRef, true)).toBe('below')
    expect(classifyBenchmark(timeRef.p75 + 0.1, timeRef, false)).toBe('below')
  })
})
