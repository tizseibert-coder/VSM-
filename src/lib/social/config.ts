// Die Stellschrauben des Social-Media-Agenten, an einer Stelle.
//
// Alles hier ist bewusst Code und nicht Datenbank: Themen, Formate und der
// Wochenplan aendern sich selten, und wenn, dann will man die Aenderung im
// Verlauf des Repositories sehen. Was sich laufend aendert — was
// funktioniert —, steht im Regelwerk (`vsm_social_playbooks`), das der Agent
// selbst schreibt.

export const CHANNELS = ['linkedin', 'instagram'] as const
export type Channel = (typeof CHANNELS)[number]

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value)
}

/**
 * Die Themen, ueber die Taktane spricht. Jedes ist ein "Arm" im Sinne der
 * Auswahl (lib/social/bandit.ts): Welches Thema wie oft drankommt,
 * entscheiden die Messwerte, nicht diese Reihenfolge.
 *
 * Ziel ist Reichweite und Bekanntheit, deshalb ueberwiegen Themen, die ein
 * Produktionsleiter weitergibt, weil sie *ihm* nuetzen — nicht Themen, die
 * das Produkt erklaeren. Der Produktbezug ist ein Thema von acht.
 */
export const TOPICS = [
  { id: 'kpi_explained', label: 'Kennzahl erklärt (Durchlaufzeit, Taktzeit, OEE, WIP …) mit Rechenbeispiel' },
  { id: 'lean_myth', label: 'Verbreiteter Lean-/VSM-Irrtum und was stattdessen stimmt' },
  { id: 'shopfloor_story', label: 'Typische Situation aus der Fertigung (anonym, realistisch) und die Lehre daraus' },
  { id: 'vsm_howto', label: 'Wertstromanalyse Schritt für Schritt: ein konkreter Handgriff' },
  { id: 'capacity_planning', label: 'Kapazitätsplanung, Engpässe, Load Rate' },
  { id: 'quick_win', label: 'Sofort umsetzbarer Tipp für Produktionsleiter (unter 10 Minuten)' },
  { id: 'industry_question', label: 'Offene Frage an die Community, die zum Kommentieren einlädt' },
  { id: 'product_insight', label: 'Was Taktane anders macht (offener Rechenweg, Live-Berechnung) — ohne Werbesprache' },
] as const
export type TopicId = (typeof TOPICS)[number]['id']

/**
 * Formate je Kanal. Instagram braucht immer ein Bild — dort ist die Kachel
 * Pflicht, das Format unterscheidet nur, was auf ihr steht. LinkedIn traegt
 * reine Textbeitraege gut und oft besser als Bildbeitraege; ob das fuer
 * Taktane stimmt, soll die Auswertung zeigen, nicht eine Annahme.
 */
export const FORMATS: Record<Channel, readonly { id: string; label: string; needsCard: boolean }[]> = {
  linkedin: [
    { id: 'text', label: 'Reiner Textbeitrag (1200–1800 Zeichen), starke erste Zeile, kurze Absätze', needsCard: false },
    { id: 'card', label: 'Kurzer Text (400–800 Zeichen) mit Bildkachel (eine Kernaussage)', needsCard: true },
  ],
  instagram: [
    { id: 'quote_card', label: 'Kachel mit einer prägnanten Aussage, Bildunterschrift vertieft', needsCard: true },
    { id: 'number_card', label: 'Kachel mit einer Zahl/Formel im Zentrum, Bildunterschrift erklärt', needsCard: true },
  ],
}

export function formatNeedsCard(channel: Channel, format: string): boolean {
  return FORMATS[channel].find((f) => f.id === format)?.needsCard ?? channel === 'instagram'
}

/** Einstiegsarten — die erste Zeile entscheidet ueber "mehr anzeigen". Sie
 *  werden nicht als Arm gezogen (sonst waeren es zu viele Kombinationen fuer
 *  die Beitragszahl einer Woche), sondern vom Agenten gewaehlt und in der
 *  Wochenanalyse ausgewertet. */
export const HOOKS = ['question', 'number', 'contrarian', 'story', 'how_to'] as const

/**
 * Der Wochenplan: an welchen Wochentagen (1 = Montag … 7 = Sonntag) welcher
 * Kanal einen Beitrag bekommt. Drei je Kanal sind die Menge, die man ohne
 * Qualitaetsverlust durchhaelt und die trotzdem nach vier Wochen genug
 * Messpunkte fuer eine Aussage ergibt.
 *
 * Die Uhrzeit ist nicht einstellbar: Der taegliche Lauf (vercel.json) feuert
 * einmal morgens und postet dann alles, was faellig ist. Das ist die Grenze
 * des kostenlosen Vercel-Tarifs (ein Cron-Lauf pro Tag); fuer
 * Uhrzeit-Experimente braeuchte es einen stuendlichen Lauf.
 */
export const WEEKLY_SCHEDULE: Record<Channel, readonly number[]> = {
  linkedin: [2, 3, 4],
  instagram: [1, 3, 5],
}

/** Anteil der Beitraege, die bewusst ausserhalb des Bewaehrten liegen
 *  (neuer Blickwinkel, neues Format). Siehe lib/social/plan.ts. */
export const EXPLORE_SHARE = 0.2

/** Die Zeitpunkte (Stunden nach Veroeffentlichung), zu denen Messwerte
 *  abgeholt werden. Der letzte ist der, nach dem ausgewertet wird. */
export const METRIC_CHECKPOINTS_HOURS = [24, 72, 168] as const

/** Ab welchem Alter ein Beitrag in die Auswertung eingeht. Vorher ist er
 *  noch am Wachsen und saehe schlechter aus, als er ist. */
export const MIN_AGE_FOR_SCORING_HOURS = 72

/**
 * Stimme und Rahmen, die jeder Entwurf mitbekommt. Schweizer
 * Rechtschreibung (ss statt ß), weil Taktane ein Schweizer Unternehmen ist
 * und das Publikum das merkt.
 */
export const BRAND_BRIEF = `Taktane ist eine webbasierte Software für Wertstromanalyse (Value Stream Mapping nach Rother & Shook) und Kapazitätsmanagement für produzierende Unternehmen im DACH-Raum. Besonderheit: Jede Kennzahl (Durchlaufzeit, Taktzeit, Wertschöpfungsanteil, OEE, Load Rate) wird live aus den Prozessdaten gerechnet und zeigt ihren Rechenweg offen. Es gibt eine kostenlose Stufe und eine Demo ohne Anmeldung (taktane.com).

Zielgruppe: Produktionsleiter, Lean-Manager, Operational-Excellence-Verantwortliche, Industrial Engineers, Werkleiter in KMU der Industrie.

Ziel der Beiträge: Reichweite und Bekanntheit. Menschen sollen den Beitrag nützlich finden, kommentieren und teilen — nicht zum Kauf gedrängt werden. Höchstens jeder vierte Beitrag nennt Taktane überhaupt, und dann beiläufig.

Stimme: sachkundig, konkret, ruhig, ohne Marketingfloskeln, ohne Emojis-Feuerwerk (höchstens eines, wenn es etwas trägt). Zahlen und Rechenbeispiele statt Behauptungen. Sprache: Deutsch mit Schweizer Rechtschreibung (immer "ss", nie "ß"). Anrede wie auf der Website "Sie"; wo es geht, ohne direkte Anrede formulieren.

Harte Regeln: keine erfundenen Kundennamen, Studien oder Statistiken; Beispiele als Beispiele kennzeichnen. Keine Versprechen zu Einsparungen. Keine Links im LinkedIn-Text (drückt die Reichweite) — wenn überhaupt, "Link im ersten Kommentar". Instagram: 3–6 passende Hashtags am Ende. LinkedIn: höchstens 3 Hashtags am Ende.`
