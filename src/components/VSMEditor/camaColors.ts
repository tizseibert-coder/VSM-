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

/** Ausgefüllte Kachel mit Text drauf (Badge in einer Tabellenzeile). */
export const CAMA_BADGE_CLASS: Record<CamaColor, string> = {
  blue: 'bg-sky-100 text-sky-800',
  green: 'bg-emerald-100 text-emerald-800',
  orange: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
}

/** Dieselben vier Farben als Hex — für den Konva-Canvas, der keine
 *  Tailwind-Klassen versteht, sondern Farbwerte direkt braucht (`fill`).
 *
 * [UX-Fund 2026-09-17] Ursprünglich sky-400/emerald-500/amber-500/red-500 —
 * als voll deckende Kreisfläche auf einer sonst schwarzweißen Strichzeichnung
 * wirkten diese Mitteltöne, allen voran das helle sky-400, zu grell/knallig.
 * Eine Stufe dunkler (600er-Reihe): bleibt aus Raumdistanz im Workshop gut
 * unterscheidbar, wirkt aber ruhiger statt neonfarben. Dieselbe Farbfamilie
 * wie CAMA_BADGE_CLASS (nur dort auf hellem Grund, hier auf dunklem Strich),
 * damit die Ampel nirgends widersprechen kann. */
export const CAMA_HEX: Record<CamaColor, string> = {
  blue: '#0284c7',
  green: '#059669',
  orange: '#d97706',
  red: '#dc2626',
}
