// A small Lean/VSM term dictionary, consumed by <TermTooltip> to explain
// jargon inline wherever it appears in the editor (KPI bar, edit panels).
// Kept as a flat, pure lookup table (no i18n system, no CMS) — YAGNI until
// there's a real need for multiple languages or editor-managed content.
// Definitions are written for the Gen-Z/Yellow-Belt persona from the
// Reifegrad-Benchmark audit: short, concrete, no unexplained jargon inside
// the definition itself.

export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY = {
  leadTime: {
    term: 'Durchlaufzeit',
    definition:
      'Die Zeit, die ein Werkstück vom ersten bis zum letzten Prozessschritt braucht — inklusive aller Warte- und Pufferzeiten dazwischen, nicht nur der reinen Bearbeitung.',
  },
  cycleTimeSum: {
    term: 'Bearbeitungszeit',
    definition:
      'Die Summe der reinen Zykluszeiten aller Prozesse in der Kette — ohne die Wartezeit im Bestand dazwischen.',
  },
  pce: {
    term: 'Wertschöpfungsanteil',
    definition:
      'Bearbeitungszeit geteilt durch Durchlaufzeit, in Prozent. Zeigt, wie viel von der gesamten Durchlaufzeit tatsächlich wertschöpfend ist statt Warten im Bestand (auch "Process Cycle Efficiency" genannt).',
  },
  taktTime: {
    term: 'Taktzeit',
    definition:
      'Verfügbare Produktionszeit geteilt durch den Kundenbedarf. Das Tempo, in dem ein Stück fertig werden muss, damit die Nachfrage gedeckt wird — kein Bearbeitungswert, sondern eine Vorgabe.',
  },
  availableMinutesPerDay: {
    term: 'Verfügbare Produktionszeit',
    definition:
      'Wie viele Minuten pro Tag tatsächlich produziert wird (z. B. eine 8h-Schicht = 480 min, zwei Schichten = 960 min, abzüglich Pausen). Der andere Faktor in der Taktzeit-Formel neben dem Kundenbedarf.',
  },
  exitRate: {
    term: 'Ist-Ausbringung (Exitrate)',
    definition:
      'Wie viele Stück pro Tag den Wertstrom tatsächlich verlassen. Bestimmt vom langsamsten Prozess (Engpass/Time Trap) nach Abzug seiner OEE-Verluste: verfügbare Produktionszeit ÷ Engpass-Zykluszeit. Nicht zu verwechseln mit dem Kundenbedarf, der die Taktzeit vorgibt — die Ausbringung ist gemessen, der Takt ist gefordert. Zusammen mit dem WIP ergibt sie die Durchlaufzeit: PLT = WIP ÷ Ausbringung.',
  },
  balanceChart: {
    term: 'Austaktungsdiagramm (Yamazumi)',
    definition:
      'Ein Balken je Station, dessen Höhe die Belegung inklusive OEE-Verluste zeigt, dazu die Taktzeit als waagrechte Linie. Anders als die Zeitleiste unter dem Wertstrom ist die Achse hier die Station und nicht die Reihenfolge — damit lässt sich ablesen, welche Station den Takt reisst und wohin Arbeitsinhalt verschoben werden könnte.',
  },
  capacityCoverage: {
    term: 'Kapazitätsdeckung',
    definition:
      'Ist-Ausbringung geteilt durch Kundenbedarf. Unter 100 % kann die Linie den Bedarf nicht decken: der Bestand wächst dann laufend an, und die Durchlaufzeit ist keine stabile Grösse mehr, sondern steigt mit jedem Tag.',
  },
  processCycleTime: {
    term: 'Zykluszeit (C/T)',
    definition: 'Die Zeit, die ein einzelner Prozessschritt braucht, um ein Werkstück zu bearbeiten.',
  },
  changeoverTime: {
    term: 'Rüstzeit (C/O)',
    definition:
      'Die Zeit, um eine Maschine oder einen Prozess von einem Produkt bzw. einer Variante auf die nächste umzustellen.',
  },
  oee: {
    term: 'OEE',
    definition:
      'Gesamtanlageneffektivität: das Produkt aus Verfügbarkeit, Leistung und Qualität. Zeigt, wie viel der theoretisch möglichen Zeit tatsächlich wertschöpfend genutzt wird.',
  },
  operatorCount: {
    term: 'Bediener-Anzahl',
    definition: 'Wie viele Personen nötig sind, um diesen Prozessschritt zu betreiben.',
  },
  pacemaker: {
    term: 'Schrittmacher-Prozess',
    definition:
      'Der eine Prozess in der Kette, der den Takt für die gesamte Produktion vorgibt — meist der letzte vor dem Versand. Nur hier plant die Produktionssteuerung, alle vorgelagerten Prozesse ziehen per Pull nach.',
  },
  wip: {
    term: 'WIP (Work in Process)',
    definition:
      'Bestand an unfertigen Werkstücken zwischen zwei Prozessschritten. Bestimmt zusammen mit dem Tagesbedarf, wie lange ein Stück an dieser Stelle wartet.',
  },
  bufferType: {
    term: 'Lager-Typ',
    definition:
      'Wie der Bestand zwischen zwei Prozessen gesteuert wird: Standard (unkontrolliert), Supermarkt (Pull — Nachschub nur bei Entnahme), FIFO-Bahn (feste Reihenfolge, begrenzte Kapazität) oder Continuous Flow (kein Puffer, Stück fließt direkt weiter).',
  },
  flowStyle: {
    term: 'Pfeil-Typ',
    definition:
      'Wie der Materialfluss dargestellt wird: Push (Standard-Weiterschieben), Pull (Entnahme aus einem Supermarkt), oder Shipment (Versand zu/von Lieferant und Kunde). "Automatisch" leitet es aus dem Lager-Typ ab.',
  },
  kanbanType: {
    term: 'Kanban-Typ',
    definition:
      'Nur bei einem Supermarkt relevant: Produktions-Kanban löst Nachproduktion beim Lieferprozess aus, Transport-Kanban löst nur den Transport eines bereits produzierten Teils aus.',
  },
  supermarket: {
    term: 'Supermarkt',
    definition:
      'Ein kontrollierter Pufferbestand, aus dem der nachgelagerte Prozess per Kanban genau das entnimmt, was er braucht — der vorgelagerte Prozess produziert nur nach, was entnommen wurde.',
  },
  fifo: {
    term: 'FIFO-Bahn',
    definition:
      'Eine First-In-First-Out-Verbindung zwischen zwei Prozessen ohne freie Entnahme — die Bearbeitungsreihenfolge bleibt zwingend erhalten, meist mit begrenzter Kapazität.',
  },
  onePieceFlow: {
    term: 'One-Piece-Flow (Continuous Flow)',
    definition:
      'Werkstücke fließen einzeln und ohne Zwischenpuffer direkt von einem Prozess zum nächsten — kein Warten, kein Bestand zwischen den Schritten.',
  },
  bottleneck: {
    term: 'Engpass',
    definition:
      'Ein Prozess, dessen effektive Zykluszeit (Zykluszeit ÷ OEE) die Taktzeit überschreitet — er kann die Kundennachfrage im aktuellen Zustand nicht bedienen.',
  },
  heijunka: {
    term: 'Heijunka (Produktionsnivellierung)',
    definition:
      'Der Produktionsmix und das Produktionsvolumen werden gleichmäßig über die Zeit verteilt statt in großen Losen — hängt am Schrittmacher, weil dort die Produktion tatsächlich eingeplant wird.',
  },
  pitch: {
    term: 'Pitch (Steuerungs-Zeitraster)',
    definition:
      'Ein fester Zeitabschnitt (Vielfaches der Taktzeit), in dem der Schrittmacher jeweils eine gleichbleibende Menge produziert und weitergibt — macht die Produktionssteuerung in handhabbaren Portionen statt stückweise.',
  },
  kaizenBlitz: {
    term: 'Kaizen-Blitz',
    definition:
      'Ein am Prozess markierter, konkreter Verbesserungspunkt, der nötig ist, um vom Ist- zum Soll-Zustand zu kommen — kein allgemeiner Verbesserungswunsch, sondern eine gezielte Notiz an genau dieser Stelle.',
  },
} as const satisfies Record<string, GlossaryEntry>

export type GlossaryKey = keyof typeof GLOSSARY

export function getGlossaryEntry(key: GlossaryKey): GlossaryEntry {
  return GLOSSARY[key]
}
