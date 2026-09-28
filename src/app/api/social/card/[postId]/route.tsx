import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { SITE_NAME } from '@/lib/seo/site'

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
 */
const WIDTH = 1080
const HEIGHT = 1350

const INK = '#18191a'
const MUTED = '#52525b'
const BRAND = '#0f5a52'
const PAPER = '#f7f7f5'

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
    return new NextResponse(null, { status: 404 })
  }
  if (!hasAdminCredentials()) return new NextResponse(null, { status: 404 })

  const { data: post } = await createAdminClient()
    .from('vsm_social_posts')
    .select('card_headline, card_subline, status')
    .eq('id', postId)
    .maybeSingle()

  if (!post || post.status === 'rejected' || !post.card_headline) {
    return new NextResponse(null, { status: 404 })
  }

  // Lange Ueberschriften bekommen eine kleinere Schrift, statt aus der
  // Kachel zu laufen. Satori bricht Zeilen um, verkleinert aber nicht.
  const headlineSize = post.card_headline.length > 50 ? 76 : post.card_headline.length > 30 ? 92 : 112

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: PAPER,
          padding: '96px 88px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 20, height: 20, backgroundColor: BRAND }} />
          <div style={{ fontSize: 30, letterSpacing: 6, color: BRAND, fontWeight: 700 }}>
            {SITE_NAME.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          <div style={{ width: 120, height: 8, backgroundColor: BRAND }} />
          <div style={{ fontSize: headlineSize, lineHeight: 1.08, color: INK, fontWeight: 700 }}>
            {post.card_headline}
          </div>
          {post.card_subline ? (
            <div style={{ fontSize: 44, lineHeight: 1.3, color: MUTED }}>{post.card_subline}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, color: MUTED }}>
          <div>Wertstromanalyse, die rechnet.</div>
          <div style={{ color: BRAND }}>taktane.com</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  )

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer()

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Kurz: Ein Entwurf wird bis zur Freigabe noch bearbeitet, und die
      // Vorschau im Verwaltungsbereich soll die Aenderung zeigen.
      'Cache-Control': 'public, max-age=60',
    },
  })
}
