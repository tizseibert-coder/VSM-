import { describe, expect, it } from 'vitest'
import { DEMO_BUFFERS, DEMO_PROCESSES, DEMO_PROJECT } from './demoProject'
import { demoOperations, type DemoState } from './demoStore'

const start = (): DemoState => ({
  project: DEMO_PROJECT,
  processes: DEMO_PROCESSES,
  buffers: DEMO_BUFFERS,
})

describe('demoOperations', () => {
  it('adds a process at the end of the chain', () => {
    const next = demoOperations.addProcess(start(), { name: 'Prüfen', cycleTime: 2.5 })
    expect(next.processes).toHaveLength(DEMO_PROCESSES.length + 1)
    expect(next.processes.at(-1)?.name).toBe('Prüfen')
    expect(next.processes.at(-1)?.cycle_time).toBe(2.5)
  })

  it('gives each added process a distinct id', () => {
    const once = demoOperations.addProcess(start(), { name: 'A', cycleTime: 1 })
    const twice = demoOperations.addProcess(once, { name: 'B', cycleTime: 1 })
    const ids = twice.processes.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('removes a process and the buffers attached to it', () => {
    const next = demoOperations.deleteProcess(start(), 'demo-p2')
    expect(next.processes.find((p) => p.id === 'demo-p2')).toBeUndefined()
    expect(
      next.buffers.some((b) => b.from_process_id === 'demo-p2' || b.to_process_id === 'demo-p2')
    ).toBe(false)
  })

  it('updates only the named fields of one process', () => {
    const next = demoOperations.updateProcess(start(), 'demo-p1', { cycle_time: 9.9 })
    const changed = next.processes.find((p) => p.id === 'demo-p1')
    expect(changed?.cycle_time).toBe(9.9)
    expect(changed?.name).toBe('Sägen')
    expect(next.processes.find((p) => p.id === 'demo-p2')?.cycle_time).toBe(3.4)
  })

  it('reorders processes into the given sequence', () => {
    const next = demoOperations.reorderProcesses(start(), [
      'demo-p2',
      'demo-p1',
      'demo-p3',
      'demo-p4',
      'demo-p5',
    ])
    expect(next.processes.map((p) => p.id).slice(0, 2)).toEqual(['demo-p2', 'demo-p1'])
  })

  it('sets the wip count on an existing buffer', () => {
    const next = demoOperations.setBufferWip(start(), {
      fromProcessId: 'demo-p1',
      toProcessId: 'demo-p2',
      wipCount: 42,
    })
    const b = next.buffers.find((x) => x.from_process_id === 'demo-p1')
    expect(b?.wip_count).toBe(42)
  })

  it('creates a buffer when none connects the two processes yet', () => {
    const withoutBuffers: DemoState = { ...start(), buffers: [] }
    const next = demoOperations.setBufferWip(withoutBuffers, {
      fromProcessId: 'demo-p1',
      toProcessId: 'demo-p2',
      wipCount: 7,
    })
    expect(next.buffers).toHaveLength(1)
    expect(next.buffers[0].wip_count).toBe(7)
  })

  it('updates the project throughput', () => {
    const next = demoOperations.updateAnnualThroughput(start(), 12345)
    expect(next.project.annual_throughput).toBe(12345)
  })

  // Die Regel aus coding-style.md, und hier besonders wichtig: React erkennt
  // eine Aenderung nur an einer neuen Referenz. Wer den Zustand an Ort und
  // Stelle veraendert, bekommt eine Demo, die auf Klicks nicht reagiert.
  it('never mutates the state it was given', () => {
    const before = start()
    const processesBefore = before.processes
    demoOperations.addProcess(before, { name: 'X', cycleTime: 1 })
    demoOperations.deleteProcess(before, 'demo-p1')
    demoOperations.updateProcess(before, 'demo-p1', { cycle_time: 99 })
    demoOperations.updateAnnualThroughput(before, 1)
    expect(before.processes).toBe(processesBefore)
    expect(before.processes).toHaveLength(DEMO_PROCESSES.length)
    expect(before.processes[0].cycle_time).toBe(1.2)
    expect(before.project.annual_throughput).toBe(50000)
  })
})
