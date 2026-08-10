import { describe, expect, it } from 'vitest'
import { checkCapacity } from './capacity'

describe('checkCapacity', () => {
  it('computes effective cycle time as cycleTime / (oee / 100)', () => {
    const result = checkCapacity({ cycleTime: 10, oee: 80 }, 20)
    expect(result.effectiveCycleTime).toBeCloseTo(12.5, 5)
  })

  it('effective cycle time equals cycle time at 100% OEE', () => {
    const result = checkCapacity({ cycleTime: 7, oee: 100 }, 20)
    expect(result.effectiveCycleTime).toBe(7)
  })

  it('treats 0% OEE as infinite effective cycle time (no real capacity)', () => {
    const result = checkCapacity({ cycleTime: 5, oee: 0 }, 20)
    expect(result.effectiveCycleTime).toBe(Infinity)
    expect(result.isBottleneck).toBe(true)
  })

  it('flags a bottleneck when effective cycle time exceeds takt', () => {
    // 10 / 0.5 = 20 > takt 15
    const result = checkCapacity({ cycleTime: 10, oee: 50 }, 15)
    expect(result.isBottleneck).toBe(true)
  })

  it('does not flag a bottleneck when effective cycle time is under takt', () => {
    // 10 / 0.8 = 12.5 < takt 15
    const result = checkCapacity({ cycleTime: 10, oee: 80 }, 15)
    expect(result.isBottleneck).toBe(false)
  })

  it('does not flag exactly-at-takt as a bottleneck (boundary)', () => {
    const result = checkCapacity({ cycleTime: 10, oee: 100 }, 10)
    expect(result.isBottleneck).toBe(false)
  })

  it('never flags a bottleneck when no takt time is known', () => {
    const result = checkCapacity({ cycleTime: 999, oee: 1 }, null)
    expect(result.isBottleneck).toBe(false)
  })

  it('a second operator can resolve a bottleneck', () => {
    // 10 / 100% OEE = 10 > takt 6 -> bottleneck with one operator
    const oneOperator = checkCapacity({ cycleTime: 10, oee: 100 }, 6)
    expect(oneOperator.isBottleneck).toBe(true)

    // 10 / 2 operators / 100% OEE = 5 <= takt 6 -> resolved
    const twoOperators = checkCapacity({ cycleTime: 10, oee: 100, operatorCount: 2 }, 6)
    expect(twoOperators.effectiveCycleTime).toBe(5)
    expect(twoOperators.isBottleneck).toBe(false)
  })
})
