// Die Schluesselliste des Lean/VSM-Woerterbuchs, das <TermTooltip> ueberall
// im Editor an den Fachbegriff haengt (Kennzahlenleiste, Bearbeitungspanels).
//
// Bis zur Mehrsprachigkeit standen Begriff und Definition hier als deutsche
// Zeichenketten. Beides liegt jetzt in messages/{de,en}.json unter dem
// Namensraum `Glossary` — sonst gaebe es die Texte pro Sprache einmal im
// Quelltext. Zurueck bleibt genau das, was sprachunabhaengig ist: welche
// Begriffe es ueberhaupt gibt.
//
// Die Definitionen sind fuer die Yellow-Belt-Persona aus dem
// Reifegrad-Benchmark geschrieben: kurz, konkret, kein unerklaerter Jargon
// innerhalb der Erklaerung selbst.

export const GLOSSARY_KEYS = [
  'leadTime',
  'cycleTimeSum',
  'pce',
  'taktTime',
  'availableMinutesPerDay',
  'exitRate',
  'balanceChart',
  'capacityCoverage',
  'processCycleTime',
  'changeoverTime',
  'oee',
  'operatorCount',
  'pacemaker',
  'wip',
  'bufferType',
  'flowStyle',
  'kanbanType',
  'supermarket',
  'fifo',
  'onePieceFlow',
  'bottleneck',
  'heijunka',
  'pitch',
  'kaizenBlitz',
] as const

export type GlossaryKey = (typeof GLOSSARY_KEYS)[number]
