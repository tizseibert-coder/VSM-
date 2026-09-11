import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safeNextPath'

// Ein `next`-Parameter aus der URL landet nach der Anmeldung in einem
// redirect(). Ungeprueft ist das eine offene Weiterleitung: ein Angreifer
// schickt /login?next=https://phishing.example, das Opfer meldet sich bei der
// *echten* Anwendung an und wird danach auf die fremde Seite geschickt.

describe('safeNextPath', () => {
  it('accepts a plain internal path', () => {
    expect(safeNextPath('/invite/abc123')).toBe('/invite/abc123')
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
  })

  it('keeps query and fragment of an internal path', () => {
    expect(safeNextPath('/team?status=ok#liste')).toBe('/team?status=ok#liste')
  })

  it('strips an existing locale prefix so it is not applied twice', () => {
    // Der Aufrufer setzt das Praefix selbst (redirectLocalized). Bliebe es
    // hier stehen, landete /de/login?next=/de/dashboard auf
    // "/de/de/dashboard" — eine Adresse, die es nicht gibt.
    expect(safeNextPath('/de/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/en/invite/abc123')).toBe('/invite/abc123')
    expect(safeNextPath('/de')).toBe('/')
    expect(safeNextPath('/en')).toBe('/')
  })

  it('leaves paths alone that only look like a locale prefix', () => {
    // "/dentist" faengt mit "de" an, ist aber kein Sprachsegment.
    expect(safeNextPath('/dentist')).toBe('/dentist')
    expect(safeNextPath('/demo')).toBe('/demo')
    expect(safeNextPath('/enterprise')).toBe('/enterprise')
  })

  it('rejects absolute URLs to other hosts', () => {
    expect(safeNextPath('https://phishing.example')).toBeNull()
    expect(safeNextPath('http://phishing.example/x')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    // "//host" ist der Klassiker: es sieht wie ein Pfad aus, der Browser
    // behandelt es aber als absolute URL zu einem fremden Host.
    expect(safeNextPath('//phishing.example')).toBeNull()
    expect(safeNextPath('//phishing.example/pfad')).toBeNull()
  })

  it('rejects backslash variants that some browsers normalise to //', () => {
    expect(safeNextPath('/\\phishing.example')).toBeNull()
    expect(safeNextPath('\\\\phishing.example')).toBeNull()
  })

  it('rejects other schemes', () => {
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
    expect(safeNextPath('data:text/html,x')).toBeNull()
  })

  it('rejects anything that is not an absolute path', () => {
    expect(safeNextPath('dashboard')).toBeNull()
    expect(safeNextPath('../admin')).toBeNull()
  })

  it('returns null for missing or empty input', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath('   ')).toBeNull()
  })

  it('rejects control characters that could break out of the header', () => {
    expect(safeNextPath('/ok\nLocation: https://phishing.example')).toBeNull()
    expect(safeNextPath('/ok\r\nX: 1')).toBeNull()
  })
})
