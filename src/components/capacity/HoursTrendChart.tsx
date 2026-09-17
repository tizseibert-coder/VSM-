import type { CamaHoursMonth } from '@/lib/vsm/capacityAnalysis'
import { formatDecimal } from '@/lib/vsm/numberFormat'

/**
 * Forecast vs. Ist — Plan-Stunden aus der Nachfrage-Prognose, verfügbare
 * Stunden laut Schichtmodell und tatsächlich geleistete Stunden über die
 * zwölf Monate einer Linie (Nutzergespräch 2026-09-17: "welche Stunden
 * wurden vorgecastet und welche Leistung wurde tatsächlich auch erbracht").
 *
 * Reines SVG statt einer Chart-Bibliothek — dieselbe Wahl wie VsmSketch.tsx
 * für das Hero-Bild der Startseite: zwölf Punkte, drei Linien, kein
 * Werkzeug, das eine neue Abhängigkeit rechtfertigt. Serverkomponente ohne
 * `'use client'`: nichts hier reagiert auf Ereignisse, nur `<title>` je
 * Punkt für einen nativen Hover-Wert.
 *
 * Ist-Stunden brechen die Linie an jeder Lücke (Monat ohne Eintrag) statt sie
 * zu verbinden oder als 0 zu zeichnen — sonst zeigte September bis Dezember
 * eines laufenden Jahres eine falsche Aussage ("keine Leistung"), obwohl die
 * Monate schlicht noch nicht erfasst sind.
 */

const WIDTH = 700
const HEIGHT = 220
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 }
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom

function xForMonth(index: number): number {
  return PADDING.left + (index / 11) * PLOT_WIDTH
}

function yForHours(hours: number, maxHours: number): number {
  if (maxHours <= 0) return PADDING.top + PLOT_HEIGHT
  return PADDING.top + PLOT_HEIGHT - (hours / maxHours) * PLOT_HEIGHT
}

/** Zerlegt die Ist-Stunden in zusammenhaengende Laeufe ohne Luecke —
 *  jeder Lauf wird eine eigene <polyline>, damit die Linie an einem noch
 *  nicht erfassten Monat sichtbar abbricht statt ihn stillschweigend zu
 *  ueberbruecken oder als 0 zu zeigen. */
function actualRuns(months: CamaHoursMonth[]): CamaHoursMonth[][] {
  const runs: CamaHoursMonth[][] = []
  let current: CamaHoursMonth[] = []
  for (const month of months) {
    if (month.actualHours === null) {
      if (current.length > 0) runs.push(current)
      current = []
      continue
    }
    current.push(month)
  }
  if (current.length > 0) runs.push(current)
  return runs
}

export default function HoursTrendChart({
  months,
  monthLabels,
  locale,
  legendAvailable,
  legendRequired,
  legendActual,
  ariaLabel,
}: {
  months: CamaHoursMonth[]
  /** Zwoelf kurze Monatsnamen, schon lokalisiert (z. B. "Jan", "Feb", …). */
  monthLabels: string[]
  locale: string
  legendAvailable: string
  legendRequired: string
  legendActual: string
  ariaLabel: string
}) {
  const maxHours = Math.max(
    1,
    ...months.flatMap((m) => [m.availableHours, m.requiredHours, m.actualHours ?? 0])
  )

  const availablePoints = months.map((m, i) => `${xForMonth(i)},${yForHours(m.availableHours, maxHours)}`).join(' ')
  const requiredPoints = months.map((m, i) => `${xForMonth(i)},${yForHours(m.requiredHours, maxHours)}`).join(' ')
  const runs = actualRuns(months)

  // Drei Referenzlinien (0 %, 50 %, 100 % der Skala) statt einer beliebigen
  // Schrittweite — bei wechselnder maxHours je Linie bliebe eine feste
  // Schrittweite (z. B. "alle 100 h") mal leer, mal ueberladen.
  const gridFractions = [0, 0.5, 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full"
      >
        {gridFractions.map((fraction) => {
          const y = yForHours(fraction * maxHours, maxHours)
          return (
            <g key={fraction}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth={1}
              />
              <text x={PADDING.left - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-zinc-500 text-[9px]">
                {formatDecimal(fraction * maxHours, locale, 0)}
              </text>
            </g>
          )
        })}

        {monthLabels.map((label, i) => (
          <text
            key={label + i}
            x={xForMonth(i)}
            y={HEIGHT - PADDING.bottom + 14}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px]"
          >
            {label}
          </text>
        ))}

        {/* Verfuegbare Stunden: die Obergrenze, gestrichelt. */}
        <polyline points={availablePoints} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* Plan-Stunden aus der Nachfrage-Prognose. */}
        <polyline points={requiredPoints} fill="none" stroke="#0284c7" strokeWidth={2} />

        {/* Ist-Stunden, in eigenen Laeufen ohne Luecke (siehe actualRuns). */}
        {runs.map((run, runIndex) => (
          <polyline
            key={runIndex}
            points={run.map((m) => `${xForMonth(m.month - 1)},${yForHours(m.actualHours as number, maxHours)}`).join(' ')}
            fill="none"
            stroke="#059669"
            strokeWidth={2.5}
          />
        ))}
        {months.map((m) =>
          m.actualHours === null ? null : (
            <circle
              key={m.month}
              cx={xForMonth(m.month - 1)}
              cy={yForHours(m.actualHours, maxHours)}
              r={3}
              fill="#059669"
            >
              <title>
                {monthLabels[m.month - 1]}: {formatDecimal(m.actualHours, locale, 1)} h
              </title>
            </circle>
          )
        )}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-4 border-t border-dashed border-zinc-400" />
          {legendAvailable}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 bg-sky-600" />
          {legendRequired}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 bg-emerald-600" />
          {legendActual}
        </span>
      </div>
    </div>
  )
}
