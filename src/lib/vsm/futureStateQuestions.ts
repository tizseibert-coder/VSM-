// The 8 Future-State questions (Rother/Shook, "Learning to See" — commonly
// misquoted as "7 questions"; see Karen Martin Group, "Eight Questions for
// Future State"). This module is a pure status-derivation layer: for each
// question it reads the *current* project/process/buffer data and reports
// whether it's answered, still open, or not applicable yet — never a
// separately stored "wizard progress". That's a deliberate architecture
// decision (see docs/plan-future-state-wizard.md): the future state is
// reached iteratively, not linearly, so re-entering the wizard must always
// reflect the real data, not a stale step counter.
//
// No calculation is duplicated here — everything reuses the already-tested
// modules (calculations.ts for takt time, pacemakerConsistency.ts for the
// pull-before-pacemaker check). This file only adds the *question* framing
// on top.

import { calculateKpis, type KpiBufferInput, type KpiProcessInput } from './calculations'
import { deriveChainOrder, type ChainEdge } from './chainOrder'
import { findPushBeforePacemaker, type FlowEdge } from './pacemakerConsistency'

export type QuestionStatus = 'answered' | 'open' | 'not_applicable'

export interface FutureStateQuestion {
  /** 1-8, in the canonical Rother/Shook order. */
  id: number
  question: string
  status: QuestionStatus
  /** Short German sentence describing the current state — see plan doc. */
  summary: string
}

export interface FutureStateProcessInput extends KpiProcessInput {
  id: string
  name: string
  isPacemaker: boolean
  hasHeijunka: boolean
  kaizenNote: string | null
}

export interface FutureStateBufferInput extends KpiBufferInput {
  fromProcessId: string | null
  toProcessId: string | null
  /** 'standard' | 'supermarket' | 'fifo' | 'continuous' | 'safety_stock' | null */
  bufferType: string | null
  flowStyle: string | null
}

export interface FutureStateInput {
  processes: FutureStateProcessInput[]
  buffers: FutureStateBufferInput[]
  annualThroughput: number | null
  availableMinutesPerDay?: number
  /** projects.pitch_minutes — null until Q7 is answered. */
  pitchMinutes: number | null
}

const QUESTION_TEXT: Record<number, string> = {
  1: 'Wie hoch ist der Kundenbedarf (Taktzeit)?',
  2: 'Wird auf Auftrag produziert oder ins Fertigwarenlager?',
  3: 'Wo ist kontinuierlicher Fluss möglich?',
  4: 'Wo braucht es Supermärkte, um den Fluss zu steuern (Pull)?',
  5: 'An welcher einzigen Stelle wird die Produktion eingeplant (Schrittmacher)?',
  6: 'Wie wird der Produktionsmix am Schrittmacher nivelliert (Heijunka)?',
  7: 'Welches gleichbleibende Steuerungs-Zeitraster wird genutzt (Pitch)?',
  8: 'Welche Prozessverbesserungen sind nötig, um den Future State zu erreichen (Kaizen)?',
}

function question(id: number, status: QuestionStatus, summary: string): FutureStateQuestion {
  return { id, question: QUESTION_TEXT[id], status, summary }
}

function findPacemaker(processes: FutureStateProcessInput[]): FutureStateProcessInput | undefined {
  return processes.find((p) => p.isPacemaker)
}

function buildChainOrder(processes: FutureStateProcessInput[], buffers: FutureStateBufferInput[]): string[] {
  const edges: ChainEdge[] = buffers.map((b) => ({ from: b.fromProcessId, to: b.toProcessId }))
  return deriveChainOrder(
    processes.map((p) => p.id),
    edges
  )
}

function deriveQuestion1(input: FutureStateInput): FutureStateQuestion {
  const kpis = calculateKpis({
    processes: input.processes,
    buffers: input.buffers,
    annualThroughput: input.annualThroughput,
    availableMinutesPerDay: input.availableMinutesPerDay,
  })

  if (kpis.taktTimeMinutes === null || kpis.dailyDemand === null) {
    return question(1, 'open', 'Jahresbedarf noch nicht hinterlegt — Taktzeit kann nicht berechnet werden.')
  }

  return question(
    1,
    'answered',
    `Taktzeit ${kpis.taktTimeMinutes.toFixed(1)} min bei einem Kundenbedarf von ${kpis.dailyDemand.toFixed(1)} Stück/Tag.`
  )
}

function deriveQuestion2(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(2, 'not_applicable', 'Noch keine Prozesse angelegt.')
  }

  const terminal = input.buffers.find((b) => b.toProcessId === null)
  if (!terminal) {
    return question(2, 'open', 'Kein Übergabepunkt zum Kunden gefunden.')
  }

  if (terminal.bufferType === 'supermarket') {
    return question(2, 'answered', `Fertigwarenlager als Supermarkt mit ${terminal.wipCount} Stück Bestand.`)
  }
  if (terminal.bufferType === 'safety_stock') {
    return question(2, 'answered', `Sicherheitsbestand von ${terminal.wipCount} Stück als Fertigwarenpuffer.`)
  }
  if ((terminal.bufferType === 'standard' || terminal.bufferType === null) && terminal.wipCount === 0) {
    return question(2, 'answered', 'Direktversand an den Kunden ohne Fertigwarenbestand (Build-to-Order).')
  }

  return question(
    2,
    'open',
    `Fertigbestand von ${terminal.wipCount} Stück vorhanden, aber nicht als Supermarkt typisiert — Entscheidung noch offen.`
  )
}

function internalBuffers(buffers: FutureStateBufferInput[]): FutureStateBufferInput[] {
  return buffers.filter((b) => b.fromProcessId !== null && b.toProcessId !== null)
}

function deriveQuestion3(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length < 2) {
    return question(3, 'not_applicable', 'Nur ein Prozessschritt vorhanden — kein interner Fluss zu verbinden.')
  }

  const internal = internalBuffers(input.buffers)
  const continuousCount = internal.filter((b) => b.bufferType === 'continuous').length

  if (continuousCount === 0) {
    return question(3, 'open', `Noch keine der ${internal.length} internen Verbindungen läuft als Continuous Flow.`)
  }
  return question(
    3,
    'answered',
    `${continuousCount} von ${internal.length} internen Verbindungen laufen als Continuous Flow.`
  )
}

function deriveQuestion4(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length < 2) {
    return question(4, 'not_applicable', 'Nur ein Prozessschritt vorhanden — kein Pull-System nötig.')
  }

  // Connections already running as continuous flow (Q3) don't need a
  // supermarket/FIFO — they have no buffer to control in the first place.
  const relevant = internalBuffers(input.buffers).filter((b) => b.bufferType !== 'continuous')
  if (relevant.length === 0) {
    return question(4, 'answered', 'Alle internen Verbindungen laufen bereits als Continuous Flow — kein zusätzliches Pull-System nötig.')
  }

  const pullCount = relevant.filter((b) => b.bufferType === 'supermarket' || b.bufferType === 'fifo').length
  if (pullCount === relevant.length) {
    return question(4, 'answered', `Alle ${relevant.length} verbleibenden Verbindungen laufen als Pull (Supermarkt/FIFO).`)
  }
  return question(4, 'open', `${relevant.length - pullCount} von ${relevant.length} Verbindungen laufen noch als Push (Standard).`)
}

function deriveQuestion5(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(5, 'not_applicable', 'Noch keine Prozesse angelegt.')
  }

  const pacemaker = findPacemaker(input.processes)
  if (!pacemaker) {
    return question(5, 'open', 'Noch kein Schrittmacher gesetzt.')
  }

  const chainOrder = buildChainOrder(input.processes, input.buffers)
  const edges: FlowEdge[] = input.buffers.map((b) => ({
    fromProcessId: b.fromProcessId,
    toProcessId: b.toProcessId,
    bufferType: b.bufferType,
    flowStyle: b.flowStyle,
  }))
  const pushBefore = findPushBeforePacemaker(chainOrder, pacemaker.id, edges)

  if (pushBefore.length === 0) {
    return question(5, 'answered', `Schrittmacher gesetzt: ${pacemaker.name}. Alles davor läuft bereits als Pull.`)
  }
  return question(
    5,
    'open',
    `Schrittmacher gesetzt (${pacemaker.name}), aber ${pushBefore.length} Verbindung(en) davor laufen noch als Push.`
  )
}

function deriveQuestion6(input: FutureStateInput): FutureStateQuestion {
  const pacemaker = findPacemaker(input.processes)
  if (!pacemaker) {
    return question(6, 'not_applicable', 'Erst Frage 5 (Schrittmacher) klären, bevor Heijunka sinnvoll ist.')
  }

  if (pacemaker.hasHeijunka) {
    return question(6, 'answered', `Heijunka-Box am Schrittmacher (${pacemaker.name}) aktiv.`)
  }
  return question(6, 'open', `Heijunka für den Schrittmacher (${pacemaker.name}) noch nicht aktiviert.`)
}

function deriveQuestion7(input: FutureStateInput): FutureStateQuestion {
  const kpis = calculateKpis({
    processes: input.processes,
    buffers: input.buffers,
    annualThroughput: input.annualThroughput,
    availableMinutesPerDay: input.availableMinutesPerDay,
  })

  if (kpis.taktTimeMinutes === null) {
    return question(7, 'not_applicable', 'Taktzeit (Frage 1) noch nicht bekannt.')
  }

  if (input.pitchMinutes && input.pitchMinutes > 0) {
    const units = input.pitchMinutes / kpis.taktTimeMinutes
    return question(
      7,
      'answered',
      `Pitch von ${input.pitchMinutes} min entspricht ${units.toFixed(1)} Stück pro Steuerungsintervall.`
    )
  }
  return question(7, 'open', 'Noch kein Steuerungs-Zeitraster (Pitch) festgelegt.')
}

function deriveQuestion8(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(8, 'not_applicable', 'Noch keine Prozesse angelegt.')
  }

  const notedCount = input.processes.filter((p) => (p.kaizenNote ?? '').trim().length > 0).length
  if (notedCount === 0) {
    return question(8, 'open', 'Noch keine Verbesserungspunkte (Kaizen-Blitz) markiert.')
  }
  return question(8, 'answered', `${notedCount} Kaizen-Punkt(e) markiert.`)
}

export function deriveFutureStateQuestions(input: FutureStateInput): FutureStateQuestion[] {
  return [
    deriveQuestion1(input),
    deriveQuestion2(input),
    deriveQuestion3(input),
    deriveQuestion4(input),
    deriveQuestion5(input),
    deriveQuestion6(input),
    deriveQuestion7(input),
    deriveQuestion8(input),
  ]
}
