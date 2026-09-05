// Das Firmenprofil, soweit es sich ohne Datenbank entscheiden laesst.
//
// Getrennt von `orgSettings.ts` aus demselben Grund wie `pdfSummary.ts` von
// der jsPDF-Klebeschicht: Was hier steht, ist rein und damit pruefbar — die
// Groessengrenze eines Logos, die Schreibweise einer Farbe, der Name, der
// oben auf dem Blatt steht. Was daneben steht, redet mit PostgREST und ist
// es nicht.

/** Die Bildformate, die als Logo hineinduerfen.
 *
 *  Kein SVG, obwohl das die naheliegendste Form eines Logos waere: Ein SVG
 *  ist ein Dokument, das Skripte enthalten kann. Von unserer eigenen Adresse
 *  ausgeliefert und direkt im Browser geoeffnet, laeuft es in unserem
 *  Ursprung — Rastergrafik kann das nicht. Dieselbe Liste steht als
 *  CHECK-Constraint an der Tabelle; die Oberflaeche erklaert, die Datenbank
 *  entscheidet. */
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type LogoMime = (typeof LOGO_MIME_TYPES)[number]

/**
 * 200 KiB. Nicht knapp gewaehlt, sondern grosszuegig: Ein Logo, das auf
 * einem A3-Ausdruck sauber aussieht, braucht keine 200 KiB, und wer eine
 * 3-MB-Datei aus der Bildbearbeitung hochlaedt, soll das erfahren, bevor die
 * Datenbank es tut.
 *
 * Die Zeile traegt das Bild als base64 (rund ein Drittel groesser); die
 * Grenze dort liegt bei 280 000 Zeichen und damit ueber den 273 068, die
 * daraus hoechstens werden koennen.
 */
export const MAX_LOGO_BYTES = 200 * 1024

export function isLogoMime(value: string | null | undefined): value is LogoMime {
  return typeof value === 'string' && (LOGO_MIME_TYPES as readonly string[]).includes(value)
}

/** Wie viele Bytes hinter einer base64-Zeichenkette stecken — ohne sie zu
 *  dekodieren. Vier Zeichen ergeben drei Bytes, die '='-Zeichen am Ende
 *  zaehlen nicht mit. */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/[\r\n]/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.floor((clean.length * 3) / 4) - padding
}

/**
 * Was die Datei *wirklich* ist, gelesen aus ihren ersten Bytes.
 *
 * Der Typ, den der Browser meldet, kommt aus der Dateiendung und ist damit
 * eine Behauptung des Hochladenden. Eine `logo.png`, die in Wahrheit ein SVG
 * ist, kaeme mit `image/png` herein und laege danach mit diesem Typ in der
 * Zeile. Ausgeliefert wird sie zwar mit `nosniff` und einer CSP, die alles
 * verbietet — sie liefe also nicht —, aber der Nutzer saehe ein kaputtes Bild
 * und keinen Grund. Hier faellt sie beim Hochladen auf, mit einem Satz, der
 * sagt, was los ist.
 *
 * Nur die Signaturen der drei erlaubten Formate; alles andere ergibt null.
 */
export function sniffImageMime(bytes: Uint8Array): LogoMime | null {
  const at = (i: number) => bytes[i]
  // 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return 'image/png'
  }
  // FF D8 FF — der Anfang jedes JFIF/EXIF-Bilds
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return 'image/jpeg'
  }
  // "RIFF" …vier Byte Laenge… "WEBP"
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export type LogoRejection = 'type' | 'size' | 'empty'

/**
 * Darf dieses Bild als Logo gespeichert werden?
 *
 * Gibt den Grund zurueck statt nur `false`: „zu gross" und „falsches Format"
 * fuehren zu verschiedenen naechsten Schritten, und wer beides in einem
 * „Logo konnte nicht gespeichert werden" zusammenfasst, laesst den Nutzer
 * raten.
 */
export function checkLogo(mime: string, base64: string): { ok: true } | { ok: false; reason: LogoRejection } {
  if (!isLogoMime(mime)) return { ok: false, reason: 'type' }
  const bytes = base64ByteLength(base64)
  if (bytes === 0) return { ok: false, reason: 'empty' }
  if (bytes > MAX_LOGO_BYTES) return { ok: false, reason: 'size' }
  return { ok: true }
}

/** Das Logo als `data:`-Adresse. Braucht die Einladungsseite (die es einem
 *  Nichtangemeldeten zeigt, ohne dass er dafuer eine geschuetzte Adresse
 *  abrufen koennte) und der PDF-Export, dem jsPDF genau diese Form abnimmt. */
export function logoDataUrl(mime: string | null, base64: string | null): string | null {
  if (!mime || !base64) return null
  return `data:${mime};base64,${base64}`
}

/**
 * Die Akzentfarbe in einer Schreibweise: `#rrggbb`, klein.
 *
 * Der Farbwaehler des Browsers liefert das ohnehin so, aber das Feld daneben
 * laesst sich tippen — und „0F5A52" ohne Raute oder „#0F5A52 " mit Leerzeichen
 * am Ende ist gemeint, nicht falsch. Kurzform (`#abc`) wird ausgeschrieben.
 * Alles andere ergibt null; die Vorgabe der Anwendung ist dann besser als eine
 * geratene Farbe.
 */
export function normalizeBrandColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`.toLowerCase()
  return null
}

/** Der Grundton der Anwendung — die Vorgabe, solange eine Firma keine eigene
 *  Farbe gesetzt hat. Steht als Literal auch in globals.css (--color-brand-600);
 *  hier, weil der PDF-Export kein CSS liest. */
export const DEFAULT_BRAND_COLOR = '#0f5a52'

/** Die Farbe als drei Kanaele, wie jsPDF sie braucht. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeBrandColor(hex) ?? DEFAULT_BRAND_COLOR
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

/**
 * Schwarz oder Weiss auf der Akzentfarbe — was davon lesbar ist.
 *
 * Die Farbe kommt aus dem Corporate Design des Kunden, nicht von uns; sie
 * kann Nachtblau sein oder Signalgelb. Ein fest weisser Text auf dem Balken
 * der Einladungsseite waere im zweiten Fall unlesbar. Gerechnet wird mit der
 * relativen Leuchtdichte nach WCAG, Schwelle 0,179 — der Punkt, an dem der
 * Kontrast zu Weiss und zu Schwarz gleich gross ist.
 */
export function readableTextOn(hex: string): '#ffffff' | '#18181b' {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.179 ? '#18181b' : '#ffffff'
}

/**
 * Ein bis zwei Buchstaben als Ersatzmarke, solange kein Logo hochgeladen ist.
 *
 * Besser als ein graues Kaestchen: Der Platz, an dem das Logo stehen wird,
 * ist schon besetzt und traegt schon den richtigen Namen — das Blatt springt
 * nicht um, sobald jemand das Bild nachreicht.
 */
export function brandInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s-]+/).filter(Boolean)
  if (words.length === 0) return '·'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Der Name, der oben auf dem Blatt steht.
 *
 * `organizations.name` gehoert dem gemeinsamen Login und entsteht oft aus der
 * Registrierung ("Max Muster's Organization"). Wie die Firma auf ihrem
 * eigenen Ausdruck heissen will, ist eine andere Frage — deshalb hat das
 * Profil ein eigenes Feld, und dieses gewinnt, wenn es gefuellt ist.
 */
export function orgDisplayName(
  settingsDisplayName: string | null | undefined,
  organizationName: string
): string {
  const own = settingsDisplayName?.trim()
  return own && own.length > 0 ? own : organizationName
}

/**
 * Eine eingetippte Adresse als anklickbarer Link.
 *
 * "www.firma.de" ohne Schema ist ein relativer Pfad und landet auf
 * `/de/settings/www.firma.de`. Wer die Adresse so eintraegt, meint das nicht.
 */
export function websiteHref(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  // Alles andere als http/https — `javascript:`, `data:` — waere ein Link,
  // den die Firma sich selbst in die eigene Oberflaeche legt.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  return `https://${raw}`
}

/**
 * Die Adresse, unter der das Logo einer Organisation liegt.
 *
 * Der Zeitstempel des letzten Austauschs haengt als Parameter dran. Ohne ihn
 * zeigte der Browser nach einem neuen Logo noch stundenlang das alte — die
 * Antwort darf zwischengespeichert werden (siehe die Route), und dieselbe
 * Adresse waere derselbe Eintrag im Zwischenspeicher.
 */
export function orgLogoUrl(
  organizationId: string,
  logoVersion: string | null | undefined
): string {
  const base = `/api/org-logo/${organizationId}`
  if (!logoVersion) return base
  return `${base}?v=${encodeURIComponent(logoVersion)}`
}

/**
 * Das Firmenprofil, soweit der PDF-Export es braucht.
 *
 * Bewusst eine eigene, flache Form und nicht `OrgProfile`: Der Export laeuft
 * im Browser, in einer Komponente, die ueber `dynamic(ssr:false)` nachgeladen
 * wird. Was hier steht, reist als Prop durch den Serialisierer — und das soll
 * genau das sein, was aufs Blatt kommt, nicht das ganze Profil samt
 * Telefonnummer.
 */
export type PdfBranding = {
  /** Der Name, wie er oben rechts steht. */
  companyName: string
  /**
   * Die *Adresse* des Logos, nicht das Bild.
   *
   * Eingebettet reiste es in der Server-Antwort jeder Editor-Seite mit, auch
   * bei den neunundneunzig Aufrufen, die kein PDF erzeugen. Der Export holt
   * es sich beim Klick von dieser Adresse — dann liegt es meist ohnehin schon
   * im Zwischenspeicher des Browsers, weil die Kopfleiste es zeigt.
   */
  logoUrl: string | null
  brandColor: string | null
  /** Eine Zeile unter dem Blatt — Vertraulichkeitsvermerk, Aktenzeichen. */
  reportFooter: string | null
}

/** Das Bildformat, das jsPDF neben den Daten wissen will. Null heisst: nicht
 *  einbetten, statt es mit einem geratenen Format zu versuchen. */
export function pdfImageFormat(dataUrl: string | null): 'PNG' | 'JPEG' | 'WEBP' | null {
  if (!dataUrl) return null
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return null
}
