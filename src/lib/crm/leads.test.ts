import { describe, expect, it } from 'vitest'
import { LEAD_STAGES, isPlausibleEmail, normalizeEmail, stageRank } from './leads'

describe('normalizeEmail', () => {
  // Der UNIQUE-Index steht auf `lower(email)`. Wer anders schreibt als er
  // sucht, legt zwei Interessenten fuer dieselbe Person an — bis der Index
  // dazwischengeht.
  it('schreibt klein und schneidet Leerraum ab', () => {
    expect(normalizeEmail('  Max.Muster@Firma.DE ')).toBe('max.muster@firma.de')
  })
})

describe('isPlausibleEmail', () => {
  it('nimmt gewoehnliche Adressen an', () => {
    expect(isPlausibleEmail('max.muster@firma.de')).toBe(true)
    expect(isPlausibleEmail('a@b.co')).toBe(true)
    expect(isPlausibleEmail('vorname+tag@teil.firma.example')).toBe(true)
  })

  it('weist ab, was sicher keine Adresse ist', () => {
    expect(isPlausibleEmail('')).toBe(false)
    expect(isPlausibleEmail('max')).toBe(false)
    expect(isPlausibleEmail('@firma.de')).toBe(false)
    expect(isPlausibleEmail('max@firma')).toBe(false)
    expect(isPlausibleEmail('max@@firma.de')).toBe(false)
    expect(isPlausibleEmail('max@.de')).toBe(false)
    expect(isPlausibleEmail('max@firma.')).toBe(false)
    expect(isPlausibleEmail('ma x@firma.de')).toBe(false)
    expect(isPlausibleEmail(`${'a'.repeat(250)}@firma.de`)).toBe(false)
  })

  // Absichtlich grob: Was es wirklich gibt, entscheidet der
  // Bestaetigungslink. Eine strengere Regel wirft gueltige Adressen weg.
  it('laesst Ungewoehnliches durch, statt es zu erfinden', () => {
    expect(isPlausibleEmail('post@müller.de')).toBe(true)
    expect(isPlausibleEmail('info@firma.industrie')).toBe(true)
  })
})

describe('stageRank', () => {
  it('ordnet den Trichter aufsteigend', () => {
    expect(stageRank('new')).toBeLessThan(stageRank('contacted'))
    expect(stageRank('contacted')).toBeLessThan(stageRank('qualified'))
    expect(stageRank('qualified')).toBeLessThan(stageRank('trial'))
    expect(stageRank('trial')).toBeLessThan(stageRank('customer'))
  })

  // 'lost' liegt unter 'new', damit ein verlorener Interessent, der sich
  // spaeter doch registriert, wieder hochwandern darf.
  it('stellt lost unter new', () => {
    expect(stageRank('lost')).toBeLessThan(stageRank('new'))
  })

  it('behandelt Unbekanntes wie new', () => {
    expect(stageRank('irgendwas')).toBe(stageRank('new'))
    expect(stageRank(null)).toBe(stageRank('new'))
  })

  it('kennt eine Rangzahl fuer jede Stufe', () => {
    const ranks = LEAD_STAGES.map(stageRank)
    expect(new Set(ranks).size).toBe(LEAD_STAGES.length)
  })
})
