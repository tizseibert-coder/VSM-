import { describe, expect, it } from 'vitest'
import {
  buildKpiSummaryLines,
  buildPdfFooterLine,
  buildPdfSubtitle,
  buildPdfTitle,
} from './pdfSummary'

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
  // Der Titel trug frueher zusaetzlich "— Wertstromanalyse (dd.mm.yyyy)".
  // Beides ist seit der Kopf-/Fusszeile doppelt: Die Wortmarke oben und das
  // Diagramm selbst sagen, um welche Art Dokument es geht, und das Datum steht
  // in der Fusszeile. Bei einem Projekt namens "Beispiel: Wertstromanalyse
  // Dreherei" stand das Wort dadurch zweimal in derselben Zeile.
  it('is the project name, without repeating the document type', () => {
    expect(buildPdfTitle('Dreherei Muster AG')).toBe('Dreherei Muster AG')
  })

  it('trims surrounding whitespace', () => {
    expect(buildPdfTitle('  Dreherei Muster AG  ')).toBe('Dreherei Muster AG')
  })

  it('falls back to a neutral name when the project has none', () => {
    expect(buildPdfTitle('   ')).toBe('Wertstromanalyse')
  })
})

describe('buildPdfSubtitle', () => {
  // Ohne Szenario zeigt der Editor den Ist-Zustand. Das Blatt muss das
  // benennen: Ein Ausdruck ohne Zustandsangabe ist im Gremium wertlos, weil
  // niemand weiss, ob er die Messung oder einen Vorschlag in der Hand hält.
  it('names the current state when no scenario is active', () => {
    expect(buildPdfSubtitle(null)).toBe('Ist-Zustand')
  })

  it('names the scenario when one is active', () => {
    expect(buildPdfSubtitle('A · Rüstzeit halbiert')).toBe('Future State: A · Rüstzeit halbiert')
  })

  it('falls back to the current state for a blank scenario name', () => {
    expect(buildPdfSubtitle('   ')).toBe('Ist-Zustand')
  })
})

describe('buildPdfFooterLine', () => {
  it('names the tool and the export date', () => {
    expect(buildPdfFooterLine(new Date(2026, 7, 31))).toBe(
      'Erstellt mit VSM Builder am 31.08.2026'
    )
  })

  it('pads single-digit day and month like the title does', () => {
    expect(buildPdfFooterLine(new Date(2026, 0, 5))).toBe('Erstellt mit VSM Builder am 05.01.2026')
  })
})
