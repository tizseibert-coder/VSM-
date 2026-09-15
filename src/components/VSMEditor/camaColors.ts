import type { CamaColor } from '@/lib/vsm/capacityAnalysis'

// CAMA-Ampelfarben, an einer Stelle für alle Oberflächen, die sie zeigen
// (das Kapazitätsdaten-Panel im Editor, die Kapazitätsseite) — sonst könnten
// zwei Stellen irgendwann unterschiedliche Farbtöne fürs selbe Signal zeigen,
// genau das Problem, das checkCapacity/calculateKpis in calculations.ts für
// die Engpass-Erkennung schon einmal vermieden haben ("kann nie disagree").
//
// Farbe ist nirgends das einzige Signal: Emoji und Text stehen immer daneben
// (siehe CAMA_EMOJI), nie Farbe allein — bewusst dieselbe Konvention wie das
// Original-CAMA-Vorlagendokument, das die Ampel selbst schon als 🔵🟢🟠🔴
// beschreibt.

export const CAMA_EMOJI: Record<CamaColor, string> = {
  blue: '🔵',
  green: '🟢',
  orange: '🟠',
  red: '🔴',
}

/** Kleiner Punkt/Balken, z. B. unter einem Eingabefeld. */
export const CAMA_DOT_CLASS: Record<CamaColor, string> = {
  blue: 'bg-sky-400',
  green: 'bg-emerald-500',
  orange: 'bg-amber-500',
  red: 'bg-red-500',
}

/** Ausgefüllte Kachel mit Text drauf (Badge in einer Tabellenzeile). */
export const CAMA_BADGE_CLASS: Record<CamaColor, string> = {
  blue: 'bg-sky-100 text-sky-800',
  green: 'bg-emerald-100 text-emerald-800',
  orange: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
}

/** Dieselben vier Farben als Hex — für den Konva-Canvas, der keine
 *  Tailwind-Klassen versteht, sondern Farbwerte direkt braucht (`fill`).
 *  Dieselben Tailwind-Stufen wie CAMA_DOT_CLASS (sky-400/emerald-500/
 *  amber-500/red-500), nur als Literal statt als Klassenname. */
export const CAMA_HEX: Record<CamaColor, string> = {
  blue: '#38bdf8',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
}
