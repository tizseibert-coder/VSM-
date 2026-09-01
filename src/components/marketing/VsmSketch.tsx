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

const INK = '#18181b'
const MUTED = '#52525b'
const RULE = '#d4d4d8'

type Station = {
  x: number
  name: string
  ct: string
  oee: string
  /** Wartezeit im Bestand *vor* dieser Station, in Tagen. */
  waitDays: string | null
  operators: number
}

const STATIONS: Station[] = [
  { x: 96, name: 'Sägen', ct: 'C/T: 1,2 min', oee: 'OEE: 82 %', waitDays: null, operators: 1 },
  { x: 236, name: 'Drehen', ct: 'C/T: 3,4 min', oee: 'OEE: 78 %', waitDays: '4,2', operators: 1 },
  { x: 376, name: 'Montage', ct: 'C/T: 4,1 min', oee: 'OEE: 90 %', waitDays: '12,6', operators: 2 },
]

const BOX_W = 92
const BOX_H = 58
const BOX_Y = 34

export default function VsmSketch() {
  return (
    <svg
      viewBox="0 0 500 190"
      className="h-auto w-full"
      role="img"
      aria-label="Ausschnitt eines Wertstromdiagramms mit drei Prozessen, Bestandsdreiecken und der Zeitleiter darunter"
    >
      {/* Materialfluss: Pfeile und Bestände zwischen den Stationen */}
      {STATIONS.map((s, i) => {
        const prev = STATIONS[i - 1]
        if (!prev) return null
        const from = prev.x + BOX_W
        const to = s.x
        const mid = (from + to) / 2
        return (
          <g key={`flow-${s.name}`}>
            {s.waitDays && (
              <>
                <path
                  d={`M ${mid} ${BOX_Y + 14} L ${mid + 14} ${BOX_Y + 38} L ${mid - 14} ${BOX_Y + 38} Z`}
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.4"
                />
                <text x={mid} y={BOX_Y + 35} textAnchor="middle" fontSize="7" fill={INK}>
                  {s.waitDays}
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
        <g key={s.name}>
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
            {s.name}
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
            {s.ct}
          </text>
          <text x={s.x + BOX_W / 2} y={BOX_Y + 44} textAnchor="middle" fontSize="7.5" fill={MUTED}>
            {s.oee}
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
        { x: 124, y: 128, text: '4,2 Tage' },
        { x: 250, y: 128, text: '12,6 Tage' },
        { x: 180, y: 158, text: '1,2 min' },
        { x: 320, y: 158, text: '3,4 min' },
        { x: 414, y: 158, text: '4,1 min' },
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
        16,8 Tage
      </text>
      <text x="469" y="147" textAnchor="middle" fontSize="7" fill={MUTED}>
        VA 8,7 min
      </text>
    </svg>
  )
}
