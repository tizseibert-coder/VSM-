import { describe, expect, it } from 'vitest'
import { buildKpiSummaryLines, buildPdfSubtitle, buildPdfTitle } from './pdfSummary'

// Die Beschriftungen kommen seit der Mehrsprachigkeit von aussen herein. Die
// Tests reichen deutsche Werte durch, damit die erwarteten Zeilen lesbar
// bleiben — geprueft wird die Zusammensetzung, nicht die Uebersetzung.
const LABELS = {
  cycleTimeSum: 'Bearbeitungszeit',
  leadTime: 'Durchlaufzeit',
  pce: 'Wertschöpfungsanteil',
  taktTime: 'Taktzeit',
  tiedUpCapital: 'Gebundenes Kapital',
  unitMin: 'min',
  unitDays: 'Tage',
  unitPercent: '%',
}

const STATE_LABELS = {
  currentState: 'Ist-Zustand',
  futureState: (name: string) => `Future State: ${name}`,
}

describe('buildKpiSummaryLines', () => {
  // Die Zeile fuer das Gremium: Sie kommt nur dazu, wenn ein Wert je Stueck
  // hinterlegt ist — ein leerer Geldbetrag auf dem Ausdruck wirft mehr Fragen
  // auf, als er beantwortet.
  it('adds the tied-up capital only when it is known', () => {
    const input = {
      totalCycleTimeMinutes: 12.5,
      totalLeadTimeDays: 4.2,
      valueAddedRatioPercent: 3.14,
      taktTimeMinutes: 8.0,
    }
    expect(buildKpiSummaryLines(input, LABELS, 'de')).toHaveLength(4)
    expect(buildKpiSummaryLines({ ...input, tiedUpCapital: null }, LABELS, 'de')).toHaveLength(4)
    expect(buildKpiSummaryLines({ ...input, tiedUpCapital: '465.000 €' }, LABELS, 'de').at(-1)).toBe(
      'Gebundenes Kapital: 465.000 €'
    )
  })

  it('formats all four KPIs when fully computable', () => {
    const lines = buildKpiSummaryLines(
      {
        totalCycleTimeMinutes: 12.5,
        totalLeadTimeDays: 4.2,
        valueAddedRatioPercent: 3.14,
        taktTimeMinutes: 8.0,
      },
      LABELS,
      'de'
    )
    // Deutsche Zahlen auf einem deutschen Blatt — der Grund, warum die
    // Funktion die Sprache ueberhaupt kennt.
    expect(lines).toEqual([
      'Bearbeitungszeit: 12,5 min',
      'Durchlaufzeit: 4,2 Tage',
      'Wertschöpfungsanteil: 3,14 %',
      'Taktzeit: 8,0 min',
    ])
  })

  it('shows the placeholder dash for KPIs that are not computable yet', () => {
    const lines = buildKpiSummaryLines(
      {
        totalCycleTimeMinutes: 5,
        totalLeadTimeDays: 0,
        valueAddedRatioPercent: null,
        taktTimeMinutes: null,
      },
      LABELS,
      'de'
    )
    expect(lines).toEqual([
      'Bearbeitungszeit: 5,0 min',
      'Durchlaufzeit: –',
      'Wertschöpfungsanteil: –',
      'Taktzeit: –',
    ])
  })

  it('carries units and number format through, so an English sheet reads in English', () => {
    const lines = buildKpiSummaryLines(
      {
        totalCycleTimeMinutes: 12.5,
        totalLeadTimeDays: 4.2,
        valueAddedRatioPercent: 3.14,
        taktTimeMinutes: 8.0,
      },
      {
        cycleTimeSum: 'Value-added time',
        leadTime: 'Lead time',
        pce: 'Process cycle efficiency',
        taktTime: 'Takt time',
        tiedUpCapital: 'Tied-up capital',
        unitMin: 'min',
        unitDays: 'days',
        unitPercent: '%',
      },
      'en'
    )
    expect(lines[1]).toBe('Lead time: 4.2 days')
  })
})

describe('buildPdfTitle', () => {
  // Der Titel trug frueher zusaetzlich "— Wertstromanalyse (dd.mm.yyyy)".
  // Beides ist seit der Kopf-/Fusszeile doppelt: Die Wortmarke oben und das
  // Diagramm selbst sagen, um welche Art Dokument es geht, und das Datum steht
  // in der Fusszeile.
  it('is the project name, without repeating the document type', () => {
    expect(buildPdfTitle('Dreherei Muster AG', 'Wertstromanalyse')).toBe('Dreherei Muster AG')
  })

  it('trims surrounding whitespace', () => {
    expect(buildPdfTitle('  Dreherei Muster AG  ', 'Wertstromanalyse')).toBe('Dreherei Muster AG')
  })

  it('falls back to the given neutral name when the project has none', () => {
    expect(buildPdfTitle('   ', 'Wertstromanalyse')).toBe('Wertstromanalyse')
    expect(buildPdfTitle('   ', 'Value stream map')).toBe('Value stream map')
  })
})

describe('buildPdfSubtitle', () => {
  // Ohne Szenario zeigt der Editor den Ist-Zustand. Das Blatt muss das
  // benennen: Ein Ausdruck ohne Zustandsangabe ist im Gremium wertlos, weil
  // niemand weiss, ob er die Messung oder einen Vorschlag in der Hand haelt.
  it('names the current state when no scenario is active', () => {
    expect(buildPdfSubtitle(null, STATE_LABELS)).toBe('Ist-Zustand')
  })

  it('names the scenario when one is active', () => {
    expect(buildPdfSubtitle('A · Rüstzeit halbiert', STATE_LABELS)).toBe(
      'Future State: A · Rüstzeit halbiert'
    )
  })

  it('falls back to the current state for a blank scenario name', () => {
    expect(buildPdfSubtitle('   ', STATE_LABELS)).toBe('Ist-Zustand')
  })
})
