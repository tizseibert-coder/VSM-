import { NextResponse } from 'next/server'
import { loadOrgLogo } from '@/lib/org/orgSettings'
import { isLogoMime } from '@/lib/org/branding'

/**
 * Das Firmenlogo als Bild.
 *
 * Warum eine eigene Adresse und nicht die `data:`-Form direkt im HTML: Das
 * Logo steht in der Kopfleiste jeder angemeldeten Seite. Eingebettet reisten
 * bis zu 200 KiB base64 in *jeder* Server-Antwort mit, bei jedem
 * Seitenwechsel neu. Als Bildadresse holt der Browser es einmal und nimmt es
 * danach aus seinem Zwischenspeicher. Die Ausnahme ist die Einladungsseite:
 * Sie zeigt das Logo einem Nichtangemeldeten, der es hier nicht abrufen
 * koennte, und bettet es deshalb ein.
 *
 * Gelesen wird mit dem gewoehnlichen Client des Anfragenden, also unter RLS.
 * Das ist der eigentliche Punkt dieser Datei: Wer nicht Mitglied der
 * Organisation ist, bekommt kein Bild, sondern 404 — auch dann, wenn er die
 * Id kennt. Ein oeffentlicher Bucket, das naheliegende Gegenstueck, haette
 * genau diese Grenze nicht.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params

  // Eine Id, die keine uuid ist, waere in der Abfrage ein Datenbankfehler
  // (22P02) statt eines leeren Ergebnisses.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) {
    return new NextResponse(null, { status: 404 })
  }

  const logo = await loadOrgLogo(organizationId)
  // Kein Logo und kein Zugriff ergeben dieselbe Antwort. Ein 403 waere die
  // Bestaetigung, dass es die Organisation gibt.
  if (!logo || !isLogoMime(logo.mime)) return new NextResponse(null, { status: 404 })

  const bytes = Buffer.from(logo.base64, 'base64')

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': logo.mime,
      'Content-Length': String(bytes.byteLength),
      // `private`, weil die Antwort von der Anmeldung abhaengt — ein
      // gemeinsamer Zwischenspeicher duerfte sie nicht an den naechsten
      // weitergeben. Eine Stunde, weil die Adresse den Zeitstempel des
      // letzten Austauschs traegt: Ein neues Logo ist eine neue Adresse und
      // wartet nicht auf den Ablauf.
      'Cache-Control': 'private, max-age=3600',
      // Das Bild kommt aus einem Upload. `nosniff` verhindert, dass der
      // Browser den Inhalt eigenmaechtig als etwas anderes deutet als den
      // Typ, den wir geprueft haben.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
