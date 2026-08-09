import { describe, expect, it } from 'vitest'
import { classifyBenchmark } from './benchmark'

const timeRef = { p25: 3.4, median: 2.2, p75: 1.5 } // lower is better

describe('classifyBenchmark — lower-is-better metric (e.g. cycle time)', () => {
  it('classifies a value at or below p75 as top tier', () => {
    expect(classifyBenchmark(1.5, timeRef, false)).toBe('top')
    expect(classifyBenchmark(1.0, timeRef, false)).toBe('top')
  })

  it('classifies a value between median and p75 as good', () => {
    expect(classifyBenchmark(2.0, timeRef, false)).toBe('good')
  })

  it('classifies a value between p25 and median as average', () => {
    expect(classifyBenchmark(3.0, timeRef, false)).toBe('average')
  })

  it('classifies a value worse than p25 as below', () => {
    expect(classifyBenchmark(4.0, timeRef, false)).toBe('below')
  })
})

const oeeRef = { p25: 74, median: 79, p75: 84 } // higher is better

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
})
