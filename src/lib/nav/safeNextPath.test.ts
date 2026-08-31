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
