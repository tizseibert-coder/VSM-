/**
 * Ein korrekter VSM-Ausschnitt als Vektorgrafik für die Startseite.
 *
 * Bewusst kein Bildschirmfoto: Das hier ist dieselbe Formensprache, die der
 * Editor zeichnet (Strichzeichnung in Schwarz auf Weiß, Prozessbox mit
 * Datenkasten, Bestandsdreieck, Zeitleiter aus Warte- und Bearbeitungszeit),
 * nur statisch. Wer die Seite liest und danach das Werkzeug öffnet, findet
 * exakt diese Formen wieder — ein Bildschirmfoto würde beim nächsten
 * Designwechsel still veralten.
 */

import { getLocale, getTranslations } from 'next-intl/server'

const INK = '#18181b'
const MUTED = '#52525b'
const RULE = '#d4d4d8'

type Station = {
  x: number
  /** Schluessel im VsmSketch-Namensraum, nicht der Anzeigename selbst. */
  nameKey: 'process1' | 'process2' | 'process3'
  ctMin: number
  oeePercent: number
  /** Wartezeit im Bestand *vor* dieser Station, in Tagen. */
  waitDays: number | null
  operators: number
}

// Die Zahlen stehen als Zahlen da, nicht als fertige Zeichenketten: Das
// Dezimaltrennzeichen unterscheidet sich zwischen den Sprachen (1,2 gegen
// 1.2), und ein hart geschriebenes Komma waere in der englischen Fassung
// schlicht falsch. Formatiert wird unten mit Intl.NumberFormat.
//
// "C/T", "OEE", "PLT" und "VA" bleiben unuebersetzt — das sind in beiden
// Sprachen dieselben Kuerzel der Wertstrom-Fachsprache.
const STATIONS: Station[] = [
  { x: 96, nameKey: 'process1', ctMin: 1.2, oeePercent: 82, waitDays: null, operators: 1 },
  { x: 236, nameKey: 'process2', ctMin: 3.4, oeePercent: 78, waitDays: 4.2, operators: 1 },
  { x: 376, nameKey: 'process3', ctMin: 4.1, oeePercent: 90, waitDays: 12.6, operators: 2 },
]

const BOX_W = 92
const BOX_H = 58
const BOX_Y = 34

export default async function VsmSketch() {
  const t = await getTranslations('VsmSketch')
  const locale = await getLocale()
  // Eine Nachkommastelle, sprachrichtig getrennt: "1,2" auf Deutsch,
  // "1.2" auf Englisch.
  const oneDecimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  return (
    <svg
      viewBox="0 0 500 190"
      className="h-auto w-full"
      role="img"
      aria-label={t('alt')}
    >
      {/* Materialfluss: Pfeile und Bestände zwischen den Stationen */}
      {STATIONS.map((s, i) => {
        const prev = STATIONS[i - 1]
        if (!prev) return null
        const from = prev.x + BOX_W
        const to = s.x
        const mid = (from + to) / 2
        return (
          <g key={`flow-${s.nameKey}`}>
            {s.waitDays && (
              <>
                <path
                  d={`M ${mid} ${BOX_Y + 14} L ${mid + 14} ${BOX_Y + 38} L ${mid - 14} ${BOX_Y + 38} Z`}
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.4"
                />
                <text x={mid} y={BOX_Y + 35} textAnchor="middle" fontSize="7" fill={INK}>
                  {oneDecimal.format(s.waitDays)}
                </text>
              </>
            )}
            <line
              x1={from + 2}
              y1={BOX_Y + BOX_H / 2}
              x2={to - 6}
              y2={BOX_Y + BOX_H / 2}
              stroke={INK}
              strokeWidth="1.4"
            />
            <path
              d={`M ${to - 6} ${BOX_Y + BOX_H / 2 - 4} L ${to} ${BOX_Y + BOX_H / 2} L ${to - 6} ${BOX_Y + BOX_H / 2 + 4} Z`}
              fill={INK}
            />
          </g>
        )
      })}

      {/* Prozessboxen mit Datenkasten */}
      {STATIONS.map((s) => (
        <g key={s.nameKey}>
          <rect
            x={s.x}
            y={BOX_Y}
            width={BOX_W}
            height={BOX_H}
            rx="2"
            fill="#ffffff"
            stroke={INK}
            strokeWidth="1.4"
          />
          <circle cx={s.x + BOX_W} cy={BOX_Y} r="8" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
          <text x={s.x + BOX_W} y={BOX_Y + 3} textAnchor="middle" fontSize="8" fill={INK}>
            {s.operators}
          </text>
          <text
            x={s.x + BOX_W / 2}
            y={BOX_Y + 15}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="600"
            fill={INK}
          >
            {t(s.nameKey)}
          </text>
          <line
            x1={s.x + 8}
            y1={BOX_Y + 21}
            x2={s.x + BOX_W - 8}
            y2={BOX_Y + 21}
            stroke={RULE}
            strokeWidth="1"
          />
          <text x={s.x + BOX_W / 2} y={BOX_Y + 33} textAnchor="middle" fontSize="7.5" fill={MUTED}>
            {`C/T: ${oneDecimal.format(s.ctMin)} ${t('minUnit')}`}
          </text>
          <text x={s.x + BOX_W / 2} y={BOX_Y + 44} textAnchor="middle" fontSize="7.5" fill={MUTED}>
            {`OEE: ${s.oeePercent} %`}
          </text>
        </g>
      ))}

      {/* Zeitleiter: obere Stufe Wartezeit, untere Stufe Bearbeitungszeit */}
      <path
        d="M 96 132 L 152 132 L 152 146 L 208 146 L 208 132 L 292 132 L 292 146 L 348 146 L 348 132 L 396 132 L 396 146 L 432 146"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
      />
      {[
        { x: 124, y: 128, text: `${oneDecimal.format(4.2)} ${t('daysUnit')}` },
        { x: 250, y: 128, text: `${oneDecimal.format(12.6)} ${t('daysUnit')}` },
        { x: 180, y: 158, text: `${oneDecimal.format(1.2)} ${t('minUnit')}` },
        { x: 320, y: 158, text: `${oneDecimal.format(3.4)} ${t('minUnit')}` },
        { x: 414, y: 158, text: `${oneDecimal.format(4.1)} ${t('minUnit')}` },
      ].map((l) => (
        <text key={l.text + l.x} x={l.x} y={l.y} textAnchor="middle" fontSize="7.5" fill={MUTED}>
          {l.text}
        </text>
      ))}

      {/* Summenkasten am Ende der Leiter, wie im Editor */}
      <rect
        x="440"
        y="108"
        width="58"
        height="46"
        rx="2"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.4"
      />
      <text x="469" y="121" textAnchor="middle" fontSize="7.5" fill={MUTED}>
        PLT
      </text>
      <text x="469" y="134" textAnchor="middle" fontSize="9.5" fontWeight="600" fill={INK}>
        {`${oneDecimal.format(16.8)} ${t('daysUnit')}`}
      </text>
      <text x="469" y="147" textAnchor="middle" fontSize="7" fill={MUTED}>
        {`VA ${oneDecimal.format(8.7)} ${t('minUnit')}`}
      </text>
    </svg>
  )
}
