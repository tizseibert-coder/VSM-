import { describe, expect, it } from 'vitest'
import { buildComparisonRows } from './scenarioComparison'

describe('buildComparisonRows', () => {
  it('returns one row per state, in the given order', () => {
    const rows = buildComparisonRows(
      [
        { id: null, label: 'Ist-Zustand', processes: [], buffers: [] },
        { id: 'scn-a', label: 'Future State A', processes: [], buffers: [] },
      ],
      null
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: null, label: 'Ist-Zustand' })
    expect(rows[1]).toMatchObject({ id: 'scn-a', label: 'Future State A' })
  })

  it('reports the process count per state', () => {
    const rows = buildComparisonRows(
      [{ id: null, label: 'Ist-Zustand', processes: [{ cycleTime: 1 }, { cycleTime: 2 }], buffers: [] }],
      null
    )

    expect(rows[0].processCount).toBe(2)
  })

  it('computes independent KPIs per state against the same annual throughput', () => {
    // Ist-Zustand: 800 units of WIP; Future State: reduced to 200 units.
    // daily demand = 50'000 / 250 = 200 units/day.
    const rows = buildComparisonRows(
      [
        { id: null, label: 'Ist-Zustand', processes: [], buffers: [{ wipCount: 800 }] },
        { id: 'scn-a', label: 'Future State A', processes: [], buffers: [{ wipCount: 200 }] },
      ],
      50_000
    )

    expect(rows[0].totalLeadTimeDays).toBe(4)
    expect(rows[1].totalLeadTimeDays).toBe(1)
  })

  it('returns an empty array for no states', () => {
    expect(buildComparisonRows([], null)).toEqual([])
  })
})
