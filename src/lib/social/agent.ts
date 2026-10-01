// Die beiden Stellen, an denen Claude denkt: Entwuerfe schreiben und die
// Woche auswerten.
//
// Beide Aufrufe liefern strukturierte Ausgaben (zod-Schema), keine
// Freitext-Antwort, die hinterher zerlegt werden muesste. Ein Entwurf, dem
// ein Feld fehlt, scheitert hier laut — und nicht erst beim Posten.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { BRAND_BRIEF, FORMATS, HOOKS, TOPICS, formatNeedsCard, type Channel } from './config'
import type { PlannedSlot } from './plan'
import type { ScoredPost } from './scoring'

const MODEL = 'claude-opus-5'

export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY fehlt — ohne ihn schreibt der Agent keine Entwuerfe. Siehe .env.example.')
  }
  return new Anthropic()
}

/**
 * Ein Aufruf mit den gemeinsamen Einstellungen. `fallbacks: 'default'`
 * laesst die API bei einer Ablehnung durch einen Sicherheitsfilter
 * selbststaendig auf ein anderes Modell ausweichen, statt den Wochenplan
 * leer zu lassen.
 */
async function ask<T extends z.ZodType>(system: string, prompt: string, schema: T): Promise<z.infer<T>> {
  const response = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: prompt }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude hat die Anfrage abgelehnt.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Die Antwort wurde abgeschnitten (max_tokens).')
  }
  if (!response.parsed_output) {
    throw new Error('Die Antwort entsprach nicht dem erwarteten Format.')
  }
  return response.parsed_output as z.infer<T>
}

// ─────────────────────────────────────────────
// Entwuerfe
// ─────────────────────────────────────────────

const DraftSchema = z.object({
  drafts: z.array(
    z.object({
      slot: z.number().int().describe('Index des Platzes aus der Liste, 0-basiert'),
      hook: z.enum(HOOKS),
      body: z.string().describe('Der fertige Beitragstext bzw. die Bildunterschrift, inkl. Hashtags am Ende'),
      card_headline: z
        .string()
        .nullable()
        .describe('Nur bei Formaten mit Kachel: Kernaussage, höchstens 70 Zeichen. Sonst null.'),
      card_subline: z
        .string()
        .nullable()
        .describe('Nur bei Formaten mit Kachel: Ergänzung, höchstens 120 Zeichen. Sonst null.'),
      rationale: z.string().describe('Ein Satz: Was dieser Beitrag testet oder warum er so gebaut ist'),
    })
  ),
})

export type Draft = {
  slot: PlannedSlot
  hook: string
  body: string
  card_headline: string | null
  card_subline: string | null
  rationale: string
}

function topicLabel(id: string): string {
  return TOPICS.find((t) => t.id === id)?.label ?? id
}

function formatLabel(channel: Channel, id: string): string {
  return FORMATS[channel].find((f) => f.id === id)?.label ?? id
}

/** Die besten und schwaechsten Beitraege als Anschauung. Konkrete Beispiele
 *  bringen mehr als jede Regel ueber sie. */
function examples(scored: ScoredPost[], bodies: Map<string, string>): string {
  const pick = (list: ScoredPost[]) =>
    list
      .map(
        (p) =>
          `- [${p.channel}, ${p.topic}/${p.format}/${p.hook}, ${p.score} Sichtkontakte, ${p.relative.toFixed(1)}× Median]\n  ${(bodies.get(p.id) ?? '').slice(0, 600).replace(/\n+/g, ' ⏎ ')}`
      )
      .join('\n')
  const sorted = [...scored].sort((a, b) => b.relative - a.relative)
  if (sorted.length < 4) return '(Noch zu wenige ausgewertete Beiträge für Beispiele.)'
  return `Die stärksten bisher:\n${pick(sorted.slice(0, 3))}\n\nDie schwächsten bisher:\n${pick(sorted.slice(-3))}`
}

export async function writeDrafts(input: {
  slots: PlannedSlot[]
  playbook: string | null
  scored: ScoredPost[]
  bodies: Map<string, string>
  recentBodies: string[]
}): Promise<Draft[]> {
  const system = `Du bist der Social-Media-Redakteur von Taktane und schreibst Beiträge für LinkedIn und Instagram.\n\n${BRAND_BRIEF}`

  const slotList = input.slots
    .map((s, i) => {
      const card = formatNeedsCard(s.channel, s.format)
      return `${i}. ${s.date} · ${s.channel} · Thema: ${topicLabel(s.topic)} · Format: ${formatLabel(s.channel, s.format)}${card ? ' (mit Kachel)' : ' (ohne Kachel, card_* = null)'}${s.explore ? ' · VERSUCH: bewusst einen neuen Blickwinkel oder eine ungewohnte Einstiegsart probieren' : ''}`
    })
    .join('\n')

  const prompt = `Schreibe für jeden der folgenden Plätze genau einen Beitrag.

## Plätze
${slotList}

## Regelwerk (aus der Auswertung bisheriger Beiträge)
${input.playbook ?? '(Noch kein Regelwerk — es gibt noch keine Auswertung. Halte dich an die Stimme oben und variiere die Einstiegsarten, damit die erste Auswertung etwas zu vergleichen hat.)'}

## Beispiele
${examples(input.scored, input.bodies)}

## Zuletzt veröffentlicht (nicht wiederholen)
${input.recentBodies.length > 0 ? input.recentBodies.map((b) => `- ${b.slice(0, 160).replace(/\n+/g, ' ')}`).join('\n') : '(keine)'}

Achte darauf, dass die Beiträge einer Woche sich nicht gegenseitig wiederholen. LinkedIn-Texte: erste Zeile ist der Hook und muss allein stehen können (unter 110 Zeichen). Instagram-Bildunterschriften: erste Zeile ebenso, dann Mehrwert, dann Hashtags. Kachel-Texte sind kurz genug, um sie in zwei Sekunden zu lesen.`

  const result = await ask(system, prompt, DraftSchema)

  return result.drafts.flatMap((d) => {
    const slot = input.slots[d.slot]
    if (!slot) return []
    const needsCard = formatNeedsCard(slot.channel, slot.format)
    return [
      {
        slot,
        hook: d.hook,
        body: dedash(d.body.trim()),
        card_headline: needsCard ? dedash(d.card_headline?.trim() || null) : null,
        card_subline: needsCard ? dedash(d.card_subline?.trim() || null) : null,
        rationale: d.rationale.trim(),
      },
    ]
  })
}

/**
 * Entfernt Gedankenstriche aus einem fertigen Text — die Anweisung im
 * Markenbrief ist die erste Verteidigungslinie, das hier die zweite: Ein
 * Modell haelt sich nicht jedes Mal an jede Regel, und der Gedankenstrich
 * ist das staerkste einzelne Erkennungsmerkmal fuer KI-Text. Ersetzt wird
 * nur die eingeschobene Form (" — " als Satzzeichen), nicht ein Zahlenbereich
 * wie "3–6" ohne Leerzeichen — der ist normale deutsche Typografie.
 */
export function dedash<T extends string | null>(text: T): T {
  if (text === null) return text
  return text.replace(/\s+[—–]\s+/g, ', ') as T
}

// ─────────────────────────────────────────────
// Wochenanalyse
// ─────────────────────────────────────────────

const AnalysisSchema = z.object({
  headline: z.string().describe('Die wichtigste Erkenntnis in einem Satz'),
  working: z.array(z.string()).describe('Was nachweislich funktioniert (mit Zahlen)'),
  not_working: z.array(z.string()).describe('Was nachweislich nicht funktioniert (mit Zahlen)'),
  next_tests: z.array(z.string()).describe('Zwei bis vier Hypothesen für die nächsten Wochen'),
  playbook: z
    .string()
    .describe('Das vollständige, aktualisierte Regelwerk als Markdown — ersetzt das bisherige. Konkrete Anweisungen für den Redakteur.'),
})

export type Analysis = z.infer<typeof AnalysisSchema>

export async function analyzePerformance(input: {
  scored: ScoredPost[]
  bodies: Map<string, string>
  previousPlaybook: string | null
}): Promise<Analysis> {
  const system = `Du bist Social-Media-Analyst für Taktane. Du wertest aus, welche Beiträge Reichweite bringen, und schreibst daraus ein Regelwerk für den Redakteur.\n\n${BRAND_BRIEF}`

  const rows = input.scored
    .map((p) => {
      const m = p.latest
      return `| ${p.channel} | ${p.topic} | ${p.format} | ${p.hook} | ${p.explore ? 'ja' : ''} | ${p.score} | ${p.relative.toFixed(2)} | ${m.reactions ?? ''} | ${m.comments ?? ''} | ${m.shares ?? ''} | ${m.saves ?? ''} | ${p.engagementRate !== null ? (p.engagementRate * 100).toFixed(1) + '%' : ''} | ${(input.bodies.get(p.id) ?? '').slice(0, 140).replace(/[\n|]+/g, ' ')} |`
    })
    .join('\n')

  const prompt = `Hier sind alle ausgewerteten Beiträge (mindestens 72 Stunden alt). "Sicht" = Impressionen bzw. Views, "rel." = Sicht geteilt durch den Median des Kanals.

| Kanal | Thema | Format | Hook | Versuch | Sicht | rel. | Reakt. | Komm. | Geteilt | Gespeich. | Interakt.-Rate | Anfang des Texts |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows}

## Bisheriges Regelwerk
${input.previousPlaybook ?? '(keines)'}

Werte aus, was die Reichweite treibt: Thema, Format, Einstiegsart, Länge, Tonalität, Wochentag. Sei ehrlich über kleine Stichproben: Eine Regel ins Regelwerk nur übernehmen, wenn sie auf mindestens 3 Beiträgen beruht; alles andere als Hypothese unter "next_tests". Behalte Regeln des bisherigen Regelwerks, die nicht widerlegt sind. Das Regelwerk richtet sich an den Redakteur und sagt ihm konkret, was er tun und lassen soll.`

  return ask(system, prompt, AnalysisSchema)
}
