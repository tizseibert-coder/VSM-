import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { SITE_NAME } from '@/lib/seo/site'
import { TOPIC_PHOTOS } from '@/lib/social/config'
import { generatePhoto, hasImageCredentials } from '@/lib/social/photo'

/**
 * Die Bildkachel eines Beitrags, als JPEG.
 *
 * Oeffentlich und ohne Anmeldung, weil Instagram das Bild beim Posten
 * selbst von dieser Adresse abholt — mit dem Service-Role-Client gelesen,
 * denn der Abrufer hat keine Sitzung. Was sie preisgibt, ist Ueberschrift
 * und Unterzeile eines Beitrags, der ohnehin zur Veroeffentlichung bestimmt
 * ist, und nur fuer den, der die uuid kennt. Verworfene Entwuerfe liefern
 * 404.
 *
 * JPEG und nicht PNG, obwohl `ImageResponse` PNG erzeugt: Die
 * Instagram-API nimmt fuer Bildbeitraege ausschliesslich JPEG an. Die
 * Umwandlung macht sharp.
 *
 * 1080 × 1350 (4:5) ist das groesste Hochformat, das Instagram im Feed
 * unbeschnitten zeigt — mehr Flaeche im Feed heisst mehr Aufmerksamkeit.
 * LinkedIn zeigt dasselbe Format ebenfalls vollstaendig.
 *
 * Mit `OPENAI_API_KEY` bekommt die Kachel ein echtes, themenpassendes Foto
 * als Hintergrund statt der einfarbigen Flaeche (siehe lib/social/photo.ts).
 * Erzeugt wird hoechstens einmal je Beitrag — das Ergebnis liegt danach in
 * `card_photo_base64` und wird von dort bedient. Ohne Schluessel oder wenn
 * die Erzeugung scheitert, bleibt es bei der einfarbigen Kachel.
 */
const WIDTH = 1080
const HEIGHT = 1350

const INK = '#18191a'
const MUTED = '#52525b'
const BRAND = '#0f5a52'
const PAPER = '#f7f7f5'

// Farben fuer die Schrift auf dem Foto-Hintergrund: Ein Foto ist an keiner
// Stelle verlaesslich hell oder dunkel, deshalb sitzt der Text auf
// dunkel-transparenten Feldern statt direkt auf dem Bild.
const SCRIM = 'rgba(10, 12, 12, 0.55)'
const TEXT_LIGHT = '#f5f5f4'
const MUTED_LIGHT = 'rgba(245, 245, 244, 0.8)'
const ACCENT_LIGHT = '#6fd9cb'

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
    return new NextResponse(null, { status: 404 })
  }
  if (!hasAdminCredentials()) return new NextResponse(null, { status: 404 })

  const db = createAdminClient()
  const { data: post } = await db
    .from('vsm_social_posts')
    .select('topic, card_headline, card_subline, status, card_photo_base64')
    .eq('id', postId)
    .maybeSingle()

  if (!post || post.status === 'rejected' || !post.card_headline) {
    return new NextResponse(null, { status: 404 })
  }

  const photo = await resolvePhoto(db, postId, post.topic, post.card_photo_base64)

  // Lange Ueberschriften bekommen eine kleinere Schrift, statt aus der
  // Kachel zu laufen. Satori bricht Zeilen um, verkleinert aber nicht.
  const headlineSize = post.card_headline.length > 50 ? 76 : post.card_headline.length > 30 ? 92 : 112
  const c = photo
    ? { headline: TEXT_LIGHT, sub: MUTED_LIGHT, accent: ACCENT_LIGHT, footer: MUTED_LIGHT, brandMark: ACCENT_LIGHT }
    : { headline: INK, sub: MUTED, accent: BRAND, footer: MUTED, brandMark: BRAND }

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Nur bei der einfarbigen Kachel gesetzt: Beim Foto-Hintergrund
          // bleibt dieses Bild transparent, damit sharp es ueber das Foto
          // legen kann.
          ...(photo ? {} : { backgroundColor: PAPER }),
          padding: '96px 88px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            alignSelf: 'flex-start',
            ...(photo ? { backgroundColor: SCRIM, borderRadius: 12, padding: '14px 22px' } : {}),
          }}
        >
          <div style={{ width: 20, height: 20, backgroundColor: c.brandMark }} />
          <div style={{ fontSize: 30, letterSpacing: 6, color: c.accent, fontWeight: 700 }}>
            {SITE_NAME.toUpperCase()}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 44,
            ...(photo ? { backgroundColor: SCRIM, borderRadius: 20, padding: '48px 52px' } : {}),
          }}
        >
          <div style={{ width: 120, height: 8, backgroundColor: c.accent }} />
          <div style={{ fontSize: headlineSize, lineHeight: 1.08, color: c.headline, fontWeight: 700 }}>
            {post.card_headline}
          </div>
          {post.card_subline ? (
            <div style={{ fontSize: 44, lineHeight: 1.3, color: c.sub }}>{post.card_subline}</div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
            fontSize: 30,
            color: c.footer,
            ...(photo ? { backgroundColor: SCRIM, borderRadius: 12, padding: '12px 22px' } : {}),
          }}
        >
          <div>Wertstromanalyse, die rechnet.</div>
          <div style={{ color: c.accent }}>taktane.com</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  )

  const overlay = Buffer.from(await png.arrayBuffer())
  const jpeg = photo
    ? await sharp(photo).resize(WIDTH, HEIGHT, { fit: 'cover' }).composite([{ input: overlay }]).jpeg({ quality: 88 }).toBuffer()
    : await sharp(overlay).jpeg({ quality: 90 }).toBuffer()

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Kurz: Ein Entwurf wird bis zur Freigabe noch bearbeitet, und die
      // Vorschau im Verwaltungsbereich soll die Aenderung zeigen. Das Foto
      // selbst wird dadurch nicht neu erzeugt (siehe resolvePhoto) — nur
      // der Text darauf ist bei jedem Aufruf aktuell.
      'Cache-Control': 'public, max-age=60',
    },
  })
}

/**
 * Das Hintergrundfoto: aus dem Zwischenspeicher, frisch erzeugt, oder gar
 * keins. Ein Fehlschlag bei der Erzeugung (Dienst nicht erreichbar, kein
 * Guthaben) faellt still auf die einfarbige Kachel zurueck — ein Beitrag
 * darf daran nicht scheitern.
 */
async function resolvePhoto(
  db: ReturnType<typeof createAdminClient>,
  postId: string,
  topic: string,
  cached: string | null
): Promise<Buffer | null> {
  if (cached) return Buffer.from(cached, 'base64')
  if (!hasImageCredentials()) return null

  const prompt = TOPIC_PHOTOS[topic as keyof typeof TOPIC_PHOTOS]
  if (!prompt) return null

  try {
    const photo = await generatePhoto(prompt)
    // Best-effort: Schlaegt das Speichern fehl, wird das Foto beim naechsten
    // Aufruf einfach erneut erzeugt — teurer, aber nicht falsch.
    await db.from('vsm_social_posts').update({ card_photo_base64: photo.toString('base64') }).eq('id', postId)
    return photo
  } catch (err) {
    console.error('social card photo generation failed:', err instanceof Error ? err.message : err)
    return null
  }
}
