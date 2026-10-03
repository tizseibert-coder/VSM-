// Tagesplanung — den SAP-Ruestplan aus Tabellenzeilen lesen.
//
// Der Export ist kein Tabellenblatt mit einer Zeile je Ruestung, sondern ein
// Block je Ruestung (nachgebaut nach parseRuestplanRows im Vorgaengertool):
//
//   05.10.26 06:00 Schicht 1 …  | | | Auftrag 1234 | | | | Vorgänger 1200
//                 | Maschine    | | T035-A02
//                 | Werkzeug    | | W-500        | | | | W-498
//                 | Artikel     | | 900037       | | | | 900000
//                 | Kurztext    | | Deckel       | | | | Rahmen
//                 | Material    | | MAT-1        | | | | MAT-2
//
// Spalte 3 ist der neue Stand, Spalte 7 der des Vorgaengers. Eine Zeile, die
// nur ein Datum traegt, ist eine Tagesueberschrift. Ein Block endet mit der
// Materialzeile oder mit dem naechsten Kopf.
//
// Die Zeilen kommen als formatierter Text (so, wie die Zellen in Excel
// aussehen); diese Datei kennt keine xlsx-Bibliothek.

import { parseSwissDate } from '../dates'
import type { PpSettings, SetupType } from '../settings'

export interface SetupPlanItem {
  order: string
  predecessor: string
  /** „Schicht N" aus dem Kopf, 1-basiert. */
  shiftNumber: number
  /** Der Schichtcode dazu: N-te Arbeitsschicht nach Beginn sortiert, null wenn es sie nicht gibt. */
  shiftCode: string | null
  /** Wanduhrzeit "YYYY-MM-DDTHH:MM" aus dem Kopf. */
  plannedStart: string
  machine: string
  article: string
  articleBefore: string
  description: string
  tool: string
  toolBefore: string
  material: string
  materialBefore: string
  setupType: SetupType
  setupMinutes: number
  /** „disponiert bis …" — wann der Vorgaenger endet, als Text wie im Export. */
  dispatchedUntil: string
}

export interface SetupPlanResult {
  /** Datum des ersten Ruestkopfs; null, wenn die Datei keinen hat. */
  planDay: string | null
  items: SetupPlanItem[]
  /** Bloecke ohne Maschine oder Artikel — nicht still verworfen, sondern gezaehlt. */
  incomplete: number
}

const HEADER = /^(\d{2}\.\d{2}\.\d{2})\s+(\d{2}):(\d{2})\s+Schicht\s+(\d)/
const DATE_ONLY = /^\d{2}\.\d{2}\.\d{2}$/
const WEIGHT_ROW = /^\d+\s*g?kg?$/i

type Draft = Omit<SetupPlanItem, 'setupType' | 'setupMinutes' | 'shiftCode'>

/**
 * Ruesttyp aus dem Vergleich alt gegen neu: Werkzeugwechsel (A),
 * Material- oder Artikelwechsel (M), beides (AM), nichts (N). Ohne jede
 * Angabe zum Vorgaenger ist kein Wechsel erkennbar — N, nicht geraten.
 */
export function classifySetup(d: Pick<Draft, 'article' | 'articleBefore' | 'tool' | 'toolBefore' | 'material' | 'materialBefore'>): SetupType {
  if (!d.articleBefore && !d.toolBefore && !d.materialBefore) return 'N'
  const changed = (now: string, before: string) => now !== '' && before !== '' && now !== before
  const tool = changed(d.tool, d.toolBefore)
  const material = changed(d.material, d.materialBefore) || changed(d.article, d.articleBefore)
  return tool && material ? 'AM' : tool ? 'A' : material ? 'M' : 'N'
}

export function parseSetupPlan(rows: readonly (readonly unknown[])[], settings: Pick<PpSettings, 'shifts' | 'setupNorms'>): SetupPlanResult {
  const workShifts = settings.shifts
    .filter((s) => s.kind === 'work' && s.startMinutes !== undefined)
    .sort((a, b) => (a.startMinutes as number) - (b.startMinutes as number))

  const items: SetupPlanItem[] = []
  let planDay: string | null = null
  let incomplete = 0
  let draft: Draft | null = null

  const commit = () => {
    if (!draft) return
    if (!draft.machine || !draft.article) {
      incomplete++
    } else {
      const setupType = classifySetup(draft)
      items.push({
        ...draft,
        shiftCode: workShifts[draft.shiftNumber - 1]?.code ?? null,
        setupType,
        setupMinutes: settings.setupNorms[setupType] ?? 0,
      })
    }
    draft = null
  }

  for (const row of rows) {
    const c = (i: number) => (row[i] === null || row[i] === undefined ? '' : String(row[i]).trim())
    const c0 = c(0)
    const label = c(1).toLowerCase()
    const now = c(3)
    const before = c(7)

    if (DATE_ONLY.test(c0)) continue

    const head = HEADER.exec(c0)
    if (head) {
      commit()
      const day = parseSwissDate(head[1])
      if (!day) continue
      planDay ??= day
      draft = {
        order: now.replace(/^Auftrag\s*/, '').split(/\s+/)[0] ?? '',
        predecessor: before.replace(/^Vorgänger\s*/, '').split(/\s+/)[0] ?? '',
        shiftNumber: Number(head[4]),
        plannedStart: `${day}T${head[2]}:${head[3]}`,
        machine: '',
        article: '',
        articleBefore: '',
        description: '',
        tool: '',
        toolBefore: '',
        material: '',
        materialBefore: '',
        dispatchedUntil: '',
      }
      continue
    }
    if (!draft) continue
    const d: Draft = draft

    if (label.includes('maschine')) {
      d.machine = now
    } else if (label.includes('disponiert')) {
      if (before.startsWith('bis ')) d.dispatchedUntil = before.slice(4).trim()
    } else if (label.includes('werkzeug') || label.includes('wkz')) {
      if (!d.tool && now) d.tool = now
      if (!d.toolBefore && before && !before.startsWith('bis ')) d.toolBefore = before
    } else if (label.includes('artikel') && !label.includes('beschr') && !label.includes('kurztext')) {
      if (!d.article) d.article = now
      if (!d.articleBefore && before) d.articleBefore = before
    } else if (label.includes('beschr') || label.includes('kurztext')) {
      d.description = now
    } else if (label.includes('material') || WEIGHT_ROW.test(c(1))) {
      if (now && !d.material) d.material = now
      if (before && !d.materialBefore) d.materialBefore = before
      // Die Materialzeile schliesst den Block, sobald Maschine und Artikel da sind.
      if (d.machine && d.article) commit()
    }
  }
  commit()
  return { planDay, items, incomplete }
}
