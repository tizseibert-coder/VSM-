import { describe, expect, it } from 'vitest'
import { computeFirstValueStreamProgress } from './firstValueStreamProgress'

describe('computeFirstValueStreamProgress', () => {
  it('reports step 1 for a bare project with nothing else', () => {
    const progress = computeFirstValueStreamProgress({
      processCount: 0,
      bufferCount: 0,
      scenarioCount: 0,
    })
    expect(progress).not.toBeNull()
    expect(progress?.currentStep).toBe(1)
    expect(progress?.nextStep).toBe('processes')
    expect(progress?.done).toEqual({
      project: true,
      processes: false,
      buffers: false,
      scenario: false,
    })
  })

  it('reports step 2 once processes exist but no inventory yet', () => {
    const progress = computeFirstValueStreamProgress({
      processCount: 5,
      bufferCount: 0,
      scenarioCount: 0,
    })
    expect(progress?.currentStep).toBe(2)
    expect(progress?.nextStep).toBe('buffers')
  })

  it('reports step 3 once processes and inventory exist but no scenario', () => {
    const progress = computeFirstValueStreamProgress({
      processCount: 5,
      bufferCount: 4,
      scenarioCount: 0,
    })
    expect(progress?.currentStep).toBe(3)
    expect(progress?.nextStep).toBe('scenario')
  })

  it('returns null once a scenario exists — the activation moment is past', () => {
    const progress = computeFirstValueStreamProgress({
      processCount: 5,
      bufferCount: 4,
      scenarioCount: 1,
    })
    expect(progress).toBeNull()
  })

  it('returns null for a scenario count of 1 even with nothing else set up', () => {
    // Ein manuell angelegtes Szenario auf einem sonst leeren Projekt ist
    // ungewoehnlich, aber der Editor verbietet es nicht — die Funktion soll
    // trotzdem nicht raten, sondern strikt nach der Definition gehen.
    const progress = computeFirstValueStreamProgress({
      processCount: 0,
      bufferCount: 0,
      scenarioCount: 1,
    })
    expect(progress).toBeNull()
  })
})
