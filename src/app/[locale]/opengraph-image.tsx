import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'

/**
 * Das Bild, das erscheint, wenn jemand den Link in Teams, LinkedIn oder
 * WhatsApp weitergibt. Bis hierher war das eine graue Kachel ohne Bild
 * (Design-Audit 2026-08-31, Befund 02/07) — und genau dieser
 * Weitergabe-Link ist der Kanal, ueber den dieses Werkzeug verkauft wird.
 *
 * Gezeigt wird, was das Produkt ausmacht: die Strichzeichnung nach
 * Rother/Shook, dieselbe Formensprache wie im Editor und auf dem PDF-Blatt,
 * darunter die drei Kennzahlen, die daraus gerechnet werden. Bewusst kein
 * Bildschirmfoto — das veraltet beim naechsten Designwechsel still, waehrend
 * diese Formen bleiben.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
/**
 * Bekannte Einschraenkung: Dieser Alternativtext bleibt auf Deutsch, auch
 * im englischen Bild.
 *
 * `alt` muss ein fester Export sein. Der von Next dafuer vorgesehene Ausweg
 * (`generateImageMetadata`) scheitert hier: Next ruft die Funktion beim
 * Sammeln der statischen Parameter auf, also ohne Anfragekontext, und jeder
 * Uebersetzungszugriff dort ist ein harter Baufehler — auch mit explizit
 * durchgereichter Sprache, weil `params` in dieser Phase nicht aufloest.
 *
 * Der sichtbare Bildinhalt ist vollstaendig uebersetzt; betroffen ist allein
 * `og:image:alt`, das Vorschaubilder in sozialen Netzen praktisch nie
 * anzeigen. Deutsch, weil es die Standardsprache ist.
 */
export const alt =
  'VSM Builder — Wertstromanalyse mit Live-Berechnung: Wertstromdiagramm mit drei Prozessen, Bestandsdreiecken und Zeitleiter'

const INK = '#18191a'
const MUTED = '#52525b'
const RULE = '#d4d4d8'
const BRAND = '#0f5a52'

/**
 * Verbindung zwischen zwei Stationen: Materialflusspfeil mit dem
 * Bestandsdreieck darueber. Bewusst ohne Text — der Rasterer, der diese SVGs
 * in das Bild einsetzt, bringt keine eigenen Schriften mit; alle
 * Beschriftungen kommen deshalb aus der Layout-Schicht darueber.
 */
function connectorSrc(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 104 104">',
    `<path d="M 52 28 L 70 60 L 34 60 Z" fill="none" stroke="${INK}" stroke-width="2"/><path d="M 52 44 L 52 55" stroke="${INK}" stroke-width="2"/>`,
    `<path d="M 0 84 L 86 84" stroke="${INK}" stroke-width="2"/>`,
    `<path d="M 86 78 L 100 84 L 86 90 Z" fill="${INK}"/>`,
    '</svg>',
  ].join('')
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Die Zeitleiter: oben die Wartezeit im Bestand, unten die Bearbeitungszeit.
 * Die schmalen Sockel gegen die langen Plateaus sind die eigentliche Aussage
 * jeder Wertstromanalyse — deshalb steht sie auch hier drauf.
 */
function ladderSrc(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="808" height="52" viewBox="0 0 808 52">',
    '<path d="M 0 40 L 200 40 L 200 10 L 304 10 L 304 40 L 504 40 L 504 10 L 608 10 L 608 40 L 808 40"',
    ` fill="none" stroke="${INK}" stroke-width="2"/>`,
    '</svg>',
  ].join('')
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Zahlen als Zahlen, damit das Dezimaltrennzeichen der Sprache folgt
// ("1,2" gegen "1.2") — siehe dieselbe Ueberlegung in VsmSketch.tsx.
const STATION_CT_MIN = [1.2, 3.4, 4.1]
const STATION_OEE = [82, 78, 90]

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Die Datei liegt im [locale]-Segment, wird von Next aber ausserhalb des
  // normalen Anfragezyklus gerendert — die Sprache muss deshalb explizit
  // durchgereicht werden, statt sich aus dem Kontext zu ergeben.
  const t = await getTranslations({ locale, namespace: 'OgImage' })
  const tSketch = await getTranslations({ locale, namespace: 'VsmSketch' })
  const oneDecimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const twoDecimals = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const STATIONS = (['process1', 'process2', 'process3'] as const).map((key, i) => ({
    name: tSketch(key),
    ct: `C/T ${oneDecimal.format(STATION_CT_MIN[i])} ${t('ctUnit')}`,
    oee: `OEE ${STATION_OEE[i]} %`,
  }))

  const KPIS = [
    { value: oneDecimal.format(18.4), unit: t('kpi1Unit'), label: t('kpi1Label') },
    { value: twoDecimals.format(0.12), unit: '%', label: t('kpi2Label') },
    { value: oneDecimal.format(2.4), unit: t('kpi3Unit'), label: t('kpi3Label') },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Der Markenstreifen ist die einzige Flaeche Farbe im Bild. Das
            Diagramm bleibt schwarz auf weiss, so wie es gedruckt wird. */}
        <div style={{ display: 'flex', height: 10, background: BRAND }} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '44px 64px 48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: 4,
              color: BRAND,
            }}
          >
            VSM BUILDER
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 16,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -1.5,
              color: INK,
            }}
          >
            {t('headline')}
          </div>

          <div style={{ display: 'flex', marginTop: 16, fontSize: 24, color: MUTED }}>
            {t('subline')}
          </div>

          {/* Prozesskette: Kasten, Bestand, Kasten. Dieselben Formen wie im
              Editor, nur ohne Bedienelemente. */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 48 }}>
            {STATIONS.map((station, i) => (
              <div key={station.name} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connectorSrc()} width={104} height={104} alt="" />
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 200,
                    border: `2px solid ${INK}`,
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '9px 0 8px',
                      fontSize: 23,
                      fontWeight: 700,
                      color: INK,
                    }}
                  >
                    {station.name}
                  </div>
                  <div style={{ display: 'flex', height: 1, background: RULE }} />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 0 10px',
                      fontSize: 17,
                      color: MUTED,
                    }}
                  >
                    <div style={{ display: 'flex' }}>{station.ct}</div>
                    <div style={{ display: 'flex', marginTop: 3 }}>{station.oee}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', marginTop: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ladderSrc()} width={808} height={52} alt="" />
          </div>

          <div style={{ display: 'flex', marginTop: 36, gap: 56 }}>
            {KPIS.map((kpi) => (
              <div key={kpi.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', color: INK }}>
                  <div style={{ display: 'flex', fontSize: 38, fontWeight: 700 }}>{kpi.value}</div>
                  <div style={{ display: 'flex', marginLeft: 7, fontSize: 19, color: MUTED }}>
                    {kpi.unit}
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 2, fontSize: 17, color: MUTED }}>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
