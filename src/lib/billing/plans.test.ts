import { describe, expect, it } from 'vitest'
import {
  PLANS,
  PUBLIC_TIERS,
  TIERS,
  isTier,
  limitsFor,
  lowestTierWith,
  quota,
  tierRank,
} from './plans'

describe('limitsFor', () => {
  it('liefert die Grenzen der angefragten Stufe', () => {
    expect(limitsFor('PROFESSIONAL').benchmark).toBe(true)
    expect(limitsFor('FREE').benchmark).toBe(false)
  })

  // Der Aufzaehlungstyp `Tier` gehoert der gemeinsamen Datenbank. Fuehrt ein
  // anderes Produkt dort eine Stufe ein, die diese Datei nicht kennt, darf das
  // nicht die Projektliste sprengen.
  it('faellt bei unbekannten Werten auf FREE zurueck', () => {
    expect(limitsFor('GOLD')).toEqual(PLANS.FREE)
    expect(limitsFor(null)).toEqual(PLANS.FREE)
    expect(limitsFor(undefined)).toEqual(PLANS.FREE)
  })
})

describe('quota', () => {
  it('erlaubt, solange die Grenze nicht erreicht ist', () => {
    expect(quota(0, 1)).toEqual({ used: 0, limit: 1, allowed: true, remaining: 1 })
    expect(quota(4, 5)).toEqual({ used: 4, limit: 5, allowed: true, remaining: 1 })
  })

  it('sperrt genau auf der Grenze, nicht erst darueber', () => {
    expect(quota(1, 1).allowed).toBe(false)
    expect(quota(5, 5).allowed).toBe(false)
  })

  // Grenze nachtraeglich gesenkt oder Tarif ausgelaufen: Der Bestand bleibt,
  // nur Neues kommt nicht mehr dazu. `remaining` darf dabei nicht negativ
  // werden — die Zahl steht so in der Oberflaeche.
  it('meldet bei Ueberschreitung 0 statt einer negativen Zahl', () => {
    expect(quota(7, 5)).toEqual({ used: 7, limit: 5, allowed: false, remaining: 0 })
  })

  it('behandelt null als unbegrenzt', () => {
    expect(quota(9999, null)).toEqual({
      used: 9999,
      limit: null,
      allowed: true,
      remaining: null,
    })
  })
})

describe('isTier', () => {
  it('erkennt die Stufen der gemeinsamen Datenbank', () => {
    for (const tier of TIERS) expect(isTier(tier)).toBe(true)
  })

  it('weist alles andere ab', () => {
    expect(isTier('free')).toBe(false)
    expect(isTier('')).toBe(false)
    expect(isTier(null)).toBe(false)
  })
})

describe('tierRank', () => {
  it('ordnet die Kaufwege aufsteigend', () => {
    expect(tierRank('FREE')).toBeLessThan(tierRank('STARTER'))
    expect(tierRank('STARTER')).toBeLessThan(tierRank('PROFESSIONAL'))
    expect(tierRank('PROFESSIONAL')).toBeLessThan(tierRank('ENTERPRISE'))
  })

  it('behandelt Unbekanntes wie FREE', () => {
    expect(tierRank('GOLD')).toBe(tierRank('FREE'))
  })
})

describe('lowestTierWith', () => {
  it('nennt die guenstigste oeffentliche Stufe mit dem Merkmal', () => {
    expect(lowestTierWith('csvImport')).toBe('STARTER')
    expect(lowestTierWith('benchmark')).toBe('PROFESSIONAL')
  })

  // Die PDF-Ausgabe ist in jeder Stufe enthalten, auch in der kostenlosen —
  // sonst waere das Ergebnis eines Workshops die Sache, die man nicht
  // mitnehmen darf.
  it('liefert FREE fuer Merkmale, die ueberall enthalten sind', () => {
    expect(lowestTierWith('pdfExport')).toBe('FREE')
  })
})

describe('Tarifliste', () => {
  it('haelt BETA aus dem oeffentlichen Angebot heraus', () => {
    expect(PUBLIC_TIERS).not.toContain('BETA')
    expect(TIERS).toContain('BETA')
  })

  // Wer eine Stufe hoeher bucht, darf nirgends weniger bekommen. Ein
  // Zahlendreher in der Tabelle daruber faellt sonst erst dem Kunden auf.
  it('macht jede oeffentliche Stufe mindestens so gross wie die darunter', () => {
    const ordered = [...PUBLIC_TIERS].sort((a, b) => tierRank(a) - tierRank(b))
    const asNumber = (value: number | null) => (value === null ? Infinity : value)

    for (let i = 1; i < ordered.length; i++) {
      const lower = PLANS[ordered[i - 1]]
      const higher = PLANS[ordered[i]]

      expect(asNumber(higher.maxProjects)).toBeGreaterThanOrEqual(asNumber(lower.maxProjects))
      expect(asNumber(higher.maxMembers)).toBeGreaterThanOrEqual(asNumber(lower.maxMembers))
      expect(asNumber(higher.maxScenariosPerProject)).toBeGreaterThanOrEqual(
        asNumber(lower.maxScenariosPerProject)
      )
      for (const feature of ['benchmark', 'csvImport', 'pdfExport'] as const) {
        if (lower[feature]) expect(higher[feature]).toBe(true)
      }
    }
  })
})
