import { describe, expect, it } from 'vitest'
import { buildKpiSummaryLines, buildPdfTitle } from './pdfSummary'

describe('buildKpiSummaryLines', () => {
  it('formats all four KPIs when fully computable', () => {
    const lines = buildKpiSummaryLines({
      totalCycleTimeMinutes: 12.5,
      totalLeadTimeDays: 4.2,
      valueAddedRatioPercent: 3.14,
      taktTimeMinutes: 8.0,
    })
    expect(lines).toEqual([
      'Bearbeitungszeit: 12.5 min',
      'Durchlaufzeit: 4.2 Tage',
      'Wertschöpfungsanteil: 3.14 %',
      'Taktzeit: 8.0 min',
    ])
  })

  it('shows the placeholder dash for KPIs that are not computable yet', () => {
    const lines = buildKpiSummaryLines({
      totalCycleTimeMinutes: 5,
      totalLeadTimeDays: 0,
      valueAddedRatioPercent: null,
      taktTimeMinutes: null,
    })
    expect(lines).toEqual([
      'Bearbeitungszeit: 5.0 min',
      'Durchlaufzeit: –',
      'Wertschöpfungsanteil: –',
      'Taktzeit: –',
    ])
  })
})

describe('buildPdfTitle', () => {
  it('combines the project name with a dd.mm.yyyy date', () => {
    const title = buildPdfTitle('Dreherei Muster AG', new Date(2026, 7, 11)) // month is 0-indexed: August
    expect(title).toBe('Dreherei Muster AG — Wertstromanalyse (11.08.2026)')
  })

  it('pads single-digit day and month', () => {
    const title = buildPdfTitle('X', new Date(2026, 0, 5)) // 5 January
    expect(title).toBe('X — Wertstromanalyse (05.01.2026)')
  })
})
