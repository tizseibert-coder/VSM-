import { describe, expect, it } from 'vitest'
import {
  MAX_LOGO_BYTES,
  base64ByteLength,
  brandInitials,
  checkLogo,
  hexToRgb,
  logoDataUrl,
  normalizeBrandColor,
  orgDisplayName,
  readableTextOn,
  sniffImageMime,
  websiteHref,
} from './branding'

/** base64 einer Datei von n Bytes, ohne die Bytes wirklich zu erzeugen. */
function base64OfBytes(n: number): string {
  return Buffer.alloc(n).toString('base64')
}

describe('base64ByteLength', () => {
  it('counts the bytes behind the encoding, not its characters', () => {
    expect(base64ByteLength(Buffer.from('abc').toString('base64'))).toBe(3)
    expect(base64ByteLength(Buffer.from('ab').toString('base64'))).toBe(2)
    expect(base64ByteLength(Buffer.from('a').toString('base64'))).toBe(1)
  })

  it('reads an empty string as zero bytes instead of a negative count', () => {
    expect(base64ByteLength('')).toBe(0)
  })

  it('ignores line breaks, which some encoders insert every 76 characters', () => {
    const raw = base64OfBytes(120)
    const wrapped = raw.replace(/(.{76})/g, '$1\n')
    expect(base64ByteLength(wrapped)).toBe(120)
  })
})

describe('checkLogo', () => {
  it('accepts the three raster formats', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(checkLogo(mime, base64OfBytes(1024))).toEqual({ ok: true })
    }
  })

  // Der Grund, aus dem SVG fehlt, steht in branding.ts: ein SVG kann Skripte
  // tragen und liefe von unserer eigenen Adresse in unserem Ursprung.
  it('rejects SVG, however natural a logo format it would be', () => {
    expect(checkLogo('image/svg+xml', base64OfBytes(1024))).toEqual({
      ok: false,
      reason: 'type',
    })
  })

  it('names the size as the reason, not just "no"', () => {
    expect(checkLogo('image/png', base64OfBytes(MAX_LOGO_BYTES + 1))).toEqual({
      ok: false,
      reason: 'size',
    })
    expect(checkLogo('image/png', base64OfBytes(MAX_LOGO_BYTES))).toEqual({ ok: true })
  })

  it('treats an empty upload as empty, not as a valid zero-byte logo', () => {
    expect(checkLogo('image/png', '')).toEqual({ ok: false, reason: 'empty' })
  })

  // Die Zeile in der Datenbank fasst 280 000 base64-Zeichen. Was hier
  // durchgeht, muss dort hineinpassen — sonst kaeme die Absage vom
  // CHECK-Constraint und lautete "new row violates check constraint".
  it('stays inside the column limit for a logo of the maximum size', () => {
    expect(base64OfBytes(MAX_LOGO_BYTES).length).toBeLessThanOrEqual(280000)
  })
})

describe('sniffImageMime', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const webp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ])

  it('reads the format out of the first bytes', () => {
    expect(sniffImageMime(png)).toBe('image/png')
    expect(sniffImageMime(jpeg)).toBe('image/jpeg')
    expect(sniffImageMime(webp)).toBe('image/webp')
  })

  // Der eigentliche Zweck: Eine `logo.png`, die in Wahrheit ein SVG ist,
  // meldet der Browser als image/png. Sie faellt hier auf, nicht erst als
  // kaputtes Bild in der Kopfleiste.
  it('sees through a file that only claims to be a PNG', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(sniffImageMime(svg)).toBeNull()
  })

  it('is null for anything else, including a file too short to tell', () => {
    expect(sniffImageMime(new Uint8Array())).toBeNull()
    expect(sniffImageMime(Uint8Array.from([0x89, 0x50]))).toBeNull()
    // RIFF ohne WEBP dahinter ist eine WAV-Datei.
    expect(
      sniffImageMime(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
      )
    ).toBeNull()
  })
})

describe('logoDataUrl', () => {
  it('builds the form jsPDF and <img> both accept', () => {
    expect(logoDataUrl('image/png', 'AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('is null when either half is missing', () => {
    expect(logoDataUrl(null, 'AAAA')).toBeNull()
    expect(logoDataUrl('image/png', null)).toBeNull()
  })
})

describe('normalizeBrandColor', () => {
  it('accepts what the colour picker sends', () => {
    expect(normalizeBrandColor('#0F5A52')).toBe('#0f5a52')
  })

  it('accepts what a person types', () => {
    expect(normalizeBrandColor('0F5A52')).toBe('#0f5a52')
    expect(normalizeBrandColor('  #0f5a52 ')).toBe('#0f5a52')
    expect(normalizeBrandColor('#abc')).toBe('#aabbcc')
  })

  it('returns null rather than guessing at nonsense', () => {
    expect(normalizeBrandColor('petrol')).toBeNull()
    expect(normalizeBrandColor('#12345')).toBeNull()
    expect(normalizeBrandColor('')).toBeNull()
    expect(normalizeBrandColor(null)).toBeNull()
  })
})

describe('readableTextOn', () => {
  // Die Farbe kommt aus dem Corporate Design des Kunden. Fest weisser Text
  // waere auf Signalgelb unlesbar, fest schwarzer auf Nachtblau.
  it('puts white on a dark ground and near-black on a light one', () => {
    expect(readableTextOn('#0f5a52')).toBe('#ffffff')
    expect(readableTextOn('#000000')).toBe('#ffffff')
    expect(readableTextOn('#ffdd00')).toBe('#18181b')
    expect(readableTextOn('#ffffff')).toBe('#18181b')
  })
})

describe('hexToRgb', () => {
  it('splits the colour into the three channels jsPDF wants', () => {
    expect(hexToRgb('#0f5a52')).toEqual({ r: 15, g: 90, b: 82 })
  })

  it('falls back to the application accent instead of throwing on junk', () => {
    expect(hexToRgb('petrol')).toEqual({ r: 15, g: 90, b: 82 })
  })
})

describe('brandInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(brandInitials('Muster Maschinenbau')).toBe('MM')
    expect(brandInitials('Weber-Technik GmbH')).toBe('WT')
  })

  it('takes two letters when there is only one word', () => {
    expect(brandInitials('Dreherei')).toBe('DR')
  })

  it('has something to draw even without a name', () => {
    expect(brandInitials('')).toBe('·')
    expect(brandInitials(null)).toBe('·')
  })
})

describe('orgDisplayName', () => {
  // organizations.name entsteht oft aus der Registrierung. Wie die Firma auf
  // ihrem eigenen Ausdruck heissen will, ist eine andere Frage.
  it('prefers the name the company chose for itself', () => {
    expect(orgDisplayName('Muster Maschinenbau GmbH', "Max Muster's Organization")).toBe(
      'Muster Maschinenbau GmbH'
    )
  })

  it('falls back to the shared-login name when nothing was chosen', () => {
    expect(orgDisplayName(null, 'Muster GmbH')).toBe('Muster GmbH')
    expect(orgDisplayName('   ', 'Muster GmbH')).toBe('Muster GmbH')
  })
})

describe('websiteHref', () => {
  it('adds the scheme a typed address is missing', () => {
    expect(websiteHref('www.muster.de')).toBe('https://www.muster.de')
    expect(websiteHref('muster.de/vsm')).toBe('https://muster.de/vsm')
  })

  it('leaves an address that already has one alone', () => {
    expect(websiteHref('http://muster.de')).toBe('http://muster.de')
    expect(websiteHref('https://muster.de')).toBe('https://muster.de')
  })

  it('refuses schemes that are not a website', () => {
    expect(websiteHref('javascript:alert(1)')).toBeNull()
    expect(websiteHref('data:text/html,<script>')).toBeNull()
  })

  it('is null when nothing was entered', () => {
    expect(websiteHref('')).toBeNull()
    expect(websiteHref(null)).toBeNull()
  })
})
