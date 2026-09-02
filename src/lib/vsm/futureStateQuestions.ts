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
  /** Schluessel im Namensraum FutureState.questions (die Zahl als Zeichenkette). */
  questionKey: string
  status: QuestionStatus
  /** Short German sentence describing the current state — see plan doc. */
  /** Schluessel im Namensraum FutureState.summary. */
  summaryKey: string
  /** Platzhalterwerte fuer summaryKey, falls der Satz welche hat. */
  summaryValues?: Record<string, string | number>
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

// Die Fragetexte selbst stehen in messages/{de,en}.json unter
// FutureState.questions — hier bleibt nur die Ableitung des Schluessels.
function question(
  id: number,
  status: QuestionStatus,
  summaryKey: string,
  summaryValues?: Record<string, string | number>
): FutureStateQuestion {
  return { id, questionKey: String(id), status, summaryKey, summaryValues }
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

  if (kpis.taktTimeMinutes === null || kpis.demandRatePerDay === null) {
    return question(1, 'open', 'q1open')
  }

  return question(1, 'answered', 'q1answered', {
    takt: kpis.taktTimeMinutes.toFixed(1),
    demand: kpis.demandRatePerDay.toFixed(1),
  })
}

function deriveQuestion2(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(2, 'not_applicable', 'noProcesses')
  }

  const terminal = input.buffers.find((b) => b.toProcessId === null)
  if (!terminal) {
    return question(2, 'open', 'q2noHandover')
  }

  if (terminal.bufferType === 'supermarket') {
    return question(2, 'answered', 'q2supermarket', { wip: terminal.wipCount })
  }
  if (terminal.bufferType === 'safety_stock') {
    return question(2, 'answered', 'q2safetyStock', { wip: terminal.wipCount })
  }
  if ((terminal.bufferType === 'standard' || terminal.bufferType === null) && terminal.wipCount === 0) {
    return question(2, 'answered', 'q2buildToOrder')
  }

  return question(2, 'open', 'q2untyped', { wip: terminal.wipCount })
}

function internalBuffers(buffers: FutureStateBufferInput[]): FutureStateBufferInput[] {
  return buffers.filter((b) => b.fromProcessId !== null && b.toProcessId !== null)
}

function deriveQuestion3(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length < 2) {
    return question(3, 'not_applicable', 'q3single')
  }

  const internal = internalBuffers(input.buffers)
  const continuousCount = internal.filter((b) => b.bufferType === 'continuous').length

  if (continuousCount === 0) {
    return question(3, 'open', 'q3none', { total: internal.length })
  }
  return question(3, 'answered', 'q3some', {
    count: continuousCount,
    total: internal.length,
  })
}

function deriveQuestion4(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length < 2) {
    return question(4, 'not_applicable', 'q4single')
  }

  // Connections already running as continuous flow (Q3) don't need a
  // supermarket/FIFO — they have no buffer to control in the first place.
  const relevant = internalBuffers(input.buffers).filter((b) => b.bufferType !== 'continuous')
  if (relevant.length === 0) {
    return question(4, 'answered', 'q4allContinuous')
  }

  const pullCount = relevant.filter((b) => b.bufferType === 'supermarket' || b.bufferType === 'fifo').length
  if (pullCount === relevant.length) {
    return question(4, 'answered', 'q4allPull', { total: relevant.length })
  }
  return question(4, 'open', 'q4somePush', {
    push: relevant.length - pullCount,
    total: relevant.length,
  })
}

function deriveQuestion5(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(5, 'not_applicable', 'noProcesses')
  }

  const pacemaker = findPacemaker(input.processes)
  if (!pacemaker) {
    return question(5, 'open', 'q5none')
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
    return question(5, 'answered', 'q5clean', { name: pacemaker.name })
  }
  return question(5, 'open', 'q5push', {
    name: pacemaker.name,
    count: pushBefore.length,
  })
}

function deriveQuestion6(input: FutureStateInput): FutureStateQuestion {
  const pacemaker = findPacemaker(input.processes)
  if (!pacemaker) {
    return question(6, 'not_applicable', 'q6needsPacemaker')
  }

  if (pacemaker.hasHeijunka) {
    return question(6, 'answered', 'q6active', { name: pacemaker.name })
  }
  return question(6, 'open', 'q6inactive', { name: pacemaker.name })
}

function deriveQuestion7(input: FutureStateInput): FutureStateQuestion {
  const kpis = calculateKpis({
    processes: input.processes,
    buffers: input.buffers,
    annualThroughput: input.annualThroughput,
    availableMinutesPerDay: input.availableMinutesPerDay,
  })

  if (kpis.taktTimeMinutes === null) {
    return question(7, 'not_applicable', 'q7needsTakt')
  }

  if (input.pitchMinutes && input.pitchMinutes > 0) {
    const units = input.pitchMinutes / kpis.taktTimeMinutes
    return question(7, 'answered', 'q7answered', {
      pitch: input.pitchMinutes,
      units: units.toFixed(1),
    })
  }
  return question(7, 'open', 'q7open')
}

function deriveQuestion8(input: FutureStateInput): FutureStateQuestion {
  if (input.processes.length === 0) {
    return question(8, 'not_applicable', 'noProcesses')
  }

  const notedCount = input.processes.filter((p) => (p.kaizenNote ?? '').trim().length > 0).length
  if (notedCount === 0) {
    return question(8, 'open', 'q8none')
  }
  return question(8, 'answered', 'q8marked', { count: notedCount })
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
