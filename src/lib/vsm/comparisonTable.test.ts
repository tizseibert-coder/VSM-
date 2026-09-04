import { describe, expect, it } from 'vitest'
import { buildComparisonMetrics, COMPARISON_EMPTY } from './comparisonTable'
import { buildComparisonRows, type ComparisonState } from './scenarioComparison'

const LABELS = {
  processes: 'Prozesse',
  cycleTimeSum: 'Bearbeitungszeit',
  leadTime: 'Durchlaufzeit',
  pce: 'Wertschöpfungsanteil',
  taktTime: 'Taktzeit',
  tiedUpCapital: 'Gebundenes Kapital',
  releasedCapital: 'Freigesetztes Kapital',
  unitMin: 'min',
  unitDays: 'Tage',
  unitPercent: '%',
}

const FORMAT = {
  num: (v: number, d = 1) => v.toFixed(d).replace('.', ','),
  money: (v: number) => `${v.toLocaleString('de-DE')} €`,
}

/** Ist-Zustand mit 1.000 Stück Bestand, Szenario mit 400. */
function rows(pieceValue: number | null) {
  const states: ComparisonState[] = [
    {
      id: null,
      label: 'Ist-Zustand',
      processes: [
        { cycleTime: 2, operatorCount: 1, oee: 100 },
        { cycleTime: 3, operatorCount: 1, oee: 100 },
      ],
      buffers: [{ wipCount: 600 }, { wipCount: 400 }],
    },
    {
      id: 's1',
      label: 'A · Supermarkt',
      processes: [
        { cycleTime: 2, operatorCount: 1, oee: 100 },
        { cycleTime: 3, operatorCount: 1, oee: 100 },
      ],
      buffers: [{ wipCount: 250 }, { wipCount: 150 }],
    },
  ]
  return { rows: buildComparisonRows(states, 50000), pieceValue }
}

describe('buildComparisonMetrics', () => {
  it('gives one value per state, in the order the states came in', () => {
    const { rows: r, pieceValue } = rows(50)
    const table = buildComparisonMetrics(r, LABELS, FORMAT, pieceValue)
    expect(table.every((m) => m.values.length === 2)).toBe(true)
    expect(table[0]).toEqual({ label: 'Prozesse', values: ['2', '2'] })
  })

  it('measures released capital against the current state, not the previous column', () => {
    const { rows: r, pieceValue } = rows(50)
    const released = buildComparisonMetrics(r, LABELS, FORMAT, pieceValue).at(-1)!
    // Der Ist-Zustand ist der Massstab und kann selbst nichts freisetzen.
    expect(released.values[0]).toBe(COMPARISON_EMPTY)
    // 1.000 Stück minus 400 Stück, je 50 € = 30.000 €.
    expect(released.values[1]).toBe('+ 30.000 €')
  })

  it('writes a scenario that builds stock with a minus sign', () => {
    const { rows: r } = rows(50)
    // Umgedreht: Das bestandsarme Szenario ist jetzt der Massstab, der
    // bestandsreiche Ist-Zustand steht als Szenario daneben.
    const swapped = [
      { ...r[1], id: null },
      { ...r[0], id: 's2' },
    ]
    const released = buildComparisonMetrics(swapped, LABELS, FORMAT, 50).at(-1)!
    expect(released.values[1]).toBe('− 30.000 €')
  })

  it('leaves both money rows empty when no piece value is set', () => {
    const { rows: r } = rows(null)
    const table = buildComparisonMetrics(r, LABELS, FORMAT, null)
    const tied = table.find((m) => m.label === LABELS.tiedUpCapital)!
    const released = table.find((m) => m.label === LABELS.releasedCapital)!
    expect(tied.values).toEqual([COMPARISON_EMPTY, COMPARISON_EMPTY])
    expect(released.values).toEqual([COMPARISON_EMPTY, COMPARISON_EMPTY])
  })

  it('formats numbers through the caller, so the sheet speaks the reader language', () => {
    const { rows: r } = rows(50)
    const table = buildComparisonMetrics(r, LABELS, FORMAT, 50)
    expect(table.find((m) => m.label === LABELS.cycleTimeSum)!.values[0]).toBe('5,0 min')
  })
})

describe('buildComparisonRows', () => {
  // [Code-Review 2026-09-04] Die Schichtzeit fehlte und calculateKpis fiel auf
  // 480 zurueck. Seit der Vergleich auf Seite zwei des PDF steht, nannten die
  // beiden Seiten desselben Blatts fuer denselben Ist-Zustand verschiedene
  // Taktzeiten.
  it('computes takt time against the project shift time, not the 480-minute default', () => {
    const state: ComparisonState = {
      id: null,
      label: 'Ist-Zustand',
      processes: [{ cycleTime: 2, operatorCount: 1, oee: 100 }],
      buffers: [],
    }
    // 50.000 Stück / 250 Tage = 200 Stück/Tag.
    const einschichtig = buildComparisonRows([state], 50000)[0]
    const zweischichtig = buildComparisonRows([state], 50000, 960)[0]
    expect(einschichtig.taktTimeMinutes).toBeCloseTo(2.4, 5)
    expect(zweischichtig.taktTimeMinutes).toBeCloseTo(4.8, 5)
  })
})
