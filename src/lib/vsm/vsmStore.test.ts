import { describe, expect, it } from 'vitest'
import { deriveChainOrder } from './chainOrder'
import { DEMO_BUFFERS, DEMO_PROCESSES, DEMO_PROJECT } from './demoProject'
import { vsmOperations, type VsmState } from './vsmStore'

const start = (): VsmState => ({
  project: DEMO_PROJECT,
  processes: DEMO_PROCESSES,
  buffers: DEMO_BUFFERS,
})

/**
 * Die Reihenfolge, in der gezeichnet wird.
 *
 * Sie steht nicht in `processes`, sondern im Puffergraph — VSMCanvas liest sie
 * mit genau diesem Aufruf. Eine Operation, die nur die Liste umsortiert und
 * die Kanten liegen laesst, bewegt auf dem Bildschirm nichts; deshalb pruefen
 * die Tests unten hierueber und nicht ueber `state.processes`.
 */
const drawnOrder = (state: VsmState): string[] =>
  deriveChainOrder(
    state.processes.map((p) => p.id),
    state.buffers.map((b) => ({ from: b.from_process_id, to: b.to_process_id }))
  )

describe('vsmOperations', () => {
  it('adds a process at the end of the chain', () => {
    const next = vsmOperations.addProcess(start(), { name: 'Prüfen', cycleTime: 2.5 })
    expect(next.processes).toHaveLength(DEMO_PROCESSES.length + 1)
    expect(next.processes.at(-1)?.name).toBe('Prüfen')
    expect(next.processes.at(-1)?.cycle_time).toBe(2.5)
  })

  it('gives each added process a distinct id', () => {
    const once = vsmOperations.addProcess(start(), { name: 'A', cycleTime: 1 })
    const twice = vsmOperations.addProcess(once, { name: 'B', cycleTime: 1 })
    const ids = twice.processes.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('removes a process and the buffers attached to it', () => {
    const next = vsmOperations.deleteProcess(start(), 'demo-p2')
    expect(next.processes.find((p) => p.id === 'demo-p2')).toBeUndefined()
    expect(
      next.buffers.some((b) => b.from_process_id === 'demo-p2' || b.to_process_id === 'demo-p2')
    ).toBe(false)
  })

  it('updates only the named fields of one process', () => {
    const next = vsmOperations.updateProcess(start(), 'demo-p1', { cycle_time: 9.9 })
    const changed = next.processes.find((p) => p.id === 'demo-p1')
    expect(changed?.cycle_time).toBe(9.9)
    expect(changed?.name).toBe('Sägen')
    expect(next.processes.find((p) => p.id === 'demo-p2')?.cycle_time).toBe(3.4)
  })

  it('hangs an added process into the chain, right before the customer', () => {
    const next = vsmOperations.addProcess(start(), { name: 'Prüfen', cycleTime: 2.5 })
    const added = next.processes.at(-1)!
    expect(drawnOrder(next)).toEqual([...DEMO_PROCESSES.map((p) => p.id), added.id])
    // Genau eine Kante zum Kunden, und zwar die des neuen letzten Prozesses.
    const terminal = next.buffers.filter((b) => b.to_process_id === null)
    expect(terminal).toHaveLength(1)
    expect(terminal[0].from_process_id).toBe(added.id)
  })

  it('creates both boundary edges for the first process of an empty project', () => {
    const empty: VsmState = { ...start(), processes: [], buffers: [] }
    const next = vsmOperations.addProcess(empty, { name: 'Sägen', cycleTime: 1 })
    const added = next.processes[0]
    expect(next.buffers.map((b) => [b.from_process_id, b.to_process_id])).toEqual([
      [null, added.id],
      [added.id, null],
    ])
    // Ohne Vorlagenzeile muessen die uebrigen Spalten trotzdem vollstaendig
    // sein — der Kasten wird sofort gezeichnet, nicht erst nach der Antwort
    // des Servers.
    expect(added.project_id).toBe(DEMO_PROJECT.id)
    expect(added.oee).toBe(100)
    expect(added.lane).toBe(0)
    expect(added.has_heijunka).toBe(false)
  })

  // Es gibt genau einen Schrittmacher; die Server-Action setzt ihn bei allen
  // anderen zurueck, und das Bild wird aus diesem Zustand gezeichnet.
  it('leaves only one pacemaker when a new one is set', () => {
    const next = vsmOperations.updateProcess(start(), 'demo-p1', { is_pacemaker: true })
    expect(next.processes.filter((p) => p.is_pacemaker).map((p) => p.id)).toEqual(['demo-p1'])
  })

  it('does not touch the pacemaker when other fields change', () => {
    const next = vsmOperations.updateProcess(start(), 'demo-p1', { cycle_time: 2 })
    expect(next.processes.filter((p) => p.is_pacemaker).map((p) => p.id)).toEqual(['demo-p5'])
  })

  it('reorders processes into the given sequence', () => {
    const next = vsmOperations.reorderProcesses(start(), [
      'demo-p2',
      'demo-p1',
      'demo-p3',
      'demo-p4',
      'demo-p5',
    ])
    expect(next.processes.map((p) => p.id).slice(0, 2)).toEqual(['demo-p2', 'demo-p1'])
  })

  // Der Fall, der den Knopf ←/→ ueberhaupt sichtbar macht: Ohne umgehaengte
  // Kanten stand die Kette nach dem Klick unveraendert da.
  it('rewires the chain so the new order is what gets drawn', () => {
    const order = ['demo-p2', 'demo-p1', 'demo-p3', 'demo-p4', 'demo-p5']
    const next = vsmOperations.reorderProcesses(start(), order)
    expect(drawnOrder(next)).toEqual(order)
  })

  it('keeps wip and buffer type on the rows it repoints', () => {
    const before = start()
    const totalWip = before.buffers.reduce((sum, b) => sum + b.wip_count, 0)
    const next = vsmOperations.reorderProcesses(before, [
      'demo-p2',
      'demo-p1',
      'demo-p3',
      'demo-p4',
      'demo-p5',
    ])
    expect(next.buffers).toHaveLength(before.buffers.length)
    expect(next.buffers.reduce((sum, b) => sum + b.wip_count, 0)).toBe(totalWip)
    expect(next.buffers.filter((b) => b.buffer_type === 'supermarket')).toHaveLength(1)
  })

  it('closes the gap in the chain when a process in the middle goes', () => {
    const next = vsmOperations.deleteProcess(start(), 'demo-p2')
    expect(drawnOrder(next)).toEqual(['demo-p1', 'demo-p3', 'demo-p4', 'demo-p5'])
  })

  it('sets the wip count on an existing buffer', () => {
    const next = vsmOperations.setBufferWip(start(), {
      fromProcessId: 'demo-p1',
      toProcessId: 'demo-p2',
      wipCount: 42,
    })
    const b = next.buffers.find((x) => x.from_process_id === 'demo-p1')
    expect(b?.wip_count).toBe(42)
  })

  it('creates a buffer when none connects the two processes yet', () => {
    const withoutBuffers: VsmState = { ...start(), buffers: [] }
    const next = vsmOperations.setBufferWip(withoutBuffers, {
      fromProcessId: 'demo-p1',
      toProcessId: 'demo-p2',
      wipCount: 7,
    })
    expect(next.buffers).toHaveLength(1)
    expect(next.buffers[0].wip_count).toBe(7)
  })

  it('updates the project throughput', () => {
    const next = vsmOperations.updateAnnualThroughput(start(), 12345)
    expect(next.project.annual_throughput).toBe(12345)
  })

  // Die Regel aus coding-style.md, und hier besonders wichtig: React erkennt
  // eine Aenderung nur an einer neuen Referenz. Wer den Zustand an Ort und
  // Stelle veraendert, bekommt eine Demo, die auf Klicks nicht reagiert.
  it('never mutates the state it was given', () => {
    const before = start()
    const processesBefore = before.processes
    vsmOperations.addProcess(before, { name: 'X', cycleTime: 1 })
    vsmOperations.deleteProcess(before, 'demo-p1')
    vsmOperations.updateProcess(before, 'demo-p1', { cycle_time: 99 })
    vsmOperations.updateAnnualThroughput(before, 1)
    expect(before.processes).toBe(processesBefore)
    expect(before.processes).toHaveLength(DEMO_PROCESSES.length)
    expect(before.processes[0].cycle_time).toBe(1.2)
    expect(before.project.annual_throughput).toBe(50000)
  })
})
