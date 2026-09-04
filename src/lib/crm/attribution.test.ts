import { describe, expect, it } from 'vitest'
import {
  attributionColumns,
  parseAttribution,
  readAttributionFromUrl,
  serializeAttribution,
} from './attribution'

const url = (href: string) => new URL(href)

describe('readAttributionFromUrl', () => {
  it('liest die fuenf utm-Felder', () => {
    const result = readAttributionFromUrl(
      url(
        'https://vsm.example.com/de?utm_source=linkedin&utm_medium=social&utm_campaign=wertstrom-q4&utm_term=vsm&utm_content=karussell-2'
      )
    )
    expect(result).toEqual({
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'wertstrom-q4',
      utmTerm: 'vsm',
      utmContent: 'karussell-2',
      referrer: undefined,
      landingPath: '/de',
    })
  })

  // Direktverkehr braucht kein Cookie. Eines zu setzen, in dem nur der Pfad
  // steht, waere ein Cookie ohne Aussage.
  it('liefert null ohne Kampagne und ohne fremde Verweisquelle', () => {
    expect(readAttributionFromUrl(url('https://vsm.example.com/de'))).toBeNull()
  })

  it('nimmt eine fremde Verweisquelle auch ohne utm-Felder', () => {
    const result = readAttributionFromUrl(
      url('https://vsm.example.com/de'),
      'https://www.linkedin.com/feed/'
    )
    expect(result?.referrer).toBe('https://www.linkedin.com/feed/')
    expect(result?.landingPath).toBe('/de')
  })

  // Der Klick von der eigenen Startseite auf die eigene Preisseite ist keine
  // Verweisquelle.
  it('verwirft die eigene Adresse als Verweisquelle', () => {
    expect(
      readAttributionFromUrl(url('https://vsm.example.com/de/pricing'), 'https://vsm.example.com/de')
    ).toBeNull()
  })

  it('ignoriert eine unlesbare Verweisquelle, statt zu werfen', () => {
    expect(readAttributionFromUrl(url('https://vsm.example.com/de'), 'kaputt')).toEqual({
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
      referrer: 'kaputt',
      landingPath: '/de',
    })
  })

  it('kuerzt ueberlange Werte', () => {
    const long = 'a'.repeat(500)
    const result = readAttributionFromUrl(url(`https://vsm.example.com/de?utm_campaign=${long}`))
    expect(result?.utmCampaign).toHaveLength(200)
  })

  it('behandelt leere Parameter wie fehlende', () => {
    expect(readAttributionFromUrl(url('https://vsm.example.com/de?utm_source=%20'))).toBeNull()
  })
})

describe('serializeAttribution / parseAttribution', () => {
  it('ueberlebt den Weg durch das Cookie', () => {
    const original = readAttributionFromUrl(
      url('https://vsm.example.com/de?utm_source=linkedin&utm_medium=social')
    )
    expect(parseAttribution(serializeAttribution(original!))).toEqual({
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
      referrer: undefined,
      landingPath: '/de',
    })
  })

  it('laesst leere Felder aus dem Cookie-Wert weg', () => {
    const json = serializeAttribution({ utmSource: 'linkedin', utmMedium: undefined })
    expect(json).toBe('{"utmSource":"linkedin"}')
  })

  // Der Wert kommt aus dem Browser des Besuchers und kann alles sein. Eine
  // kaputte Attribution darf hoechstens die Statistik kosten.
  it('liefert null statt zu werfen', () => {
    expect(parseAttribution('{kaputt')).toBeNull()
    expect(parseAttribution('null')).toBeNull()
    expect(parseAttribution('[1,2,3]')).toBeNull()
    expect(parseAttribution('"zeichenkette"')).toBeNull()
    expect(parseAttribution('')).toBeNull()
    expect(parseAttribution(undefined)).toBeNull()
  })

  it('ignoriert Felder mit falschem Typ', () => {
    expect(parseAttribution('{"utmSource":42,"utmMedium":"social"}')).toEqual({
      utmSource: undefined,
      utmMedium: 'social',
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
      referrer: undefined,
      landingPath: undefined,
    })
  })

  it('liefert null, wenn nichts Brauchbares uebrig bleibt', () => {
    expect(parseAttribution('{"fremd":"wert"}')).toBeNull()
  })
})

describe('attributionColumns', () => {
  it('setzt alle Spalten, auch ohne Attribution', () => {
    expect(attributionColumns(null)).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      landing_path: null,
    })
  })

  it('uebersetzt die Feldnamen in Spaltennamen', () => {
    expect(attributionColumns({ utmSource: 'linkedin', landingPath: '/de' })).toMatchObject({
      utm_source: 'linkedin',
      landing_path: '/de',
      utm_medium: null,
    })
  })
})
