import { describe, expect, it } from 'vitest'
import { compareDemoState, kpisForState } from './demoOutcome'
import { buildDemoState, DEMO_LABELS_DE } from './demoProject'
import type { VsmState } from './vsmStore'

/**
 * Der Abschluss unter der Demo behauptet Zahlen. Diese Tests halten fest, dass
 * er nur dann etwas behauptet, wenn sich wirklich etwas gerechnet hat — und
 * dass die Richtung stimmt. Ein Abschluss, der eine Verschlechterung als
 * Erfolg verkauft, waere an genau der Stelle unglaubwuerdig, an der die Demo
 * ueberzeugen soll.
 */

function demo(): VsmState {
  return buildDemoState(DEMO_LABELS_DE)
}

/** Eine Kopie mit geaenderter Zykluszeit an einer Station. */
function withCycleTime(state: VsmState, index: number, cycleTime: number): VsmState {
  return {
    ...state,
    processes: state.processes.map((p, i) => (i === index ? { ...p, cycle_time: cycleTime } : p)),
  }
}

describe('kpisForState', () => {
  it('rechnet den Demo-Datensatz mit Jahresbedarf und Schichtzeit des Projekts', () => {
    const kpis = kpisForState(demo())

    // Der Datensatz ist so gebaut, dass er etwas zu zeigen hat: eine
    // bekannte Durchlaufzeit und ein Wertschoepfungsanteil im Promillebereich.
    expect(kpis.totalLeadTimeDays).not.toBeNull()
    expect(kpis.totalLeadTimeDays!).toBeGreaterThan(0)
    expect(kpis.valueAddedRatioPercent).not.toBeNull()
    expect(kpis.valueAddedRatioPercent!).toBeGreaterThan(0)
    expect(kpis.exitRatePerDay).not.toBeNull()
  })
})

describe('compareDemoState', () => {
  it('meldet nichts, solange niemand etwas geaendert hat', () => {
    const outcome = compareDemoState(demo(), demo())

    expect(outcome.moved).toBe(false)
    expect(outcome.headline).toBeNull()
    expect(outcome.metrics).toEqual([])
  })

  it('meldet nichts, wenn nur ein Kasten verschoben wurde', () => {
    const before = demo()
    // x und y aendern die Darstellung, nicht die Rechnung.
    const after: VsmState = {
      ...before,
      processes: before.processes.map((p, i) => (i === 0 ? { ...p, x: (p.x ?? 0) + 240 } : p)),
    }

    expect(compareDemoState(before, after).moved).toBe(false)
  })

  it('nennt die Durchlaufzeit, wenn der Engpass entschaerft wird', () => {
    const before = demo()
    // Der Engpass des Datensatzes ist das Drehen (Index 1): 3,4 min bei 78 %
    // OEE ergeben 4,36 min effektiv und damit die langsamste Station. Wer sie
    // beschleunigt, hebt die Ausbringung und verkuerzt die Durchlaufzeit —
    // genau der Vorgang, fuer den der Abschluss gebaut ist.
    const after = withCycleTime(before, 1, 1.6)

    const outcome = compareDemoState(before, after)

    expect(outcome.moved).toBe(true)
    expect(outcome.headline?.key).toBe('leadTime')
    expect(outcome.headline?.improved).toBe(true)
    expect(outcome.headline!.after).toBeLessThan(outcome.headline!.before)
    expect(outcome.headline!.changePercent!).toBeLessThan(0)
  })

  it('nennt eine Verschlechterung als solche, statt sie zu feiern', () => {
    const before = demo()
    const after = withCycleTime(before, 1, 12)

    const outcome = compareDemoState(before, after)

    expect(outcome.moved).toBe(true)
    expect(outcome.headline?.key).toBe('leadTime')
    expect(outcome.headline?.improved).toBe(false)
    expect(outcome.headline!.changePercent!).toBeGreaterThan(0)
  })

  it('uebergeht eine Bewegung unterhalb eines Prozents', () => {
    const before = demo()
    const bufferWip = before.buffers[0].wip_count
    // Ein einzelnes Stueck mehr im ersten Bestand: rechnerisch eine Aenderung,
    // aber keine, ueber die sich ein Satz lohnt.
    const after: VsmState = {
      ...before,
      buffers: before.buffers.map((b, i) => (i === 0 ? { ...b, wip_count: bufferWip + 1 } : b)),
    }

    const outcome = compareDemoState(before, after)

    expect(outcome.moved).toBe(false)
    // Die Bewegung ist da — sie traegt nur keinen Abschluss.
    expect(outcome.metrics.length).toBeGreaterThan(0)
  })

  it('haelt Bestandsabbau als Verbesserung der Durchlaufzeit fest', () => {
    const before = demo()
    const after: VsmState = {
      ...before,
      buffers: before.buffers.map((b) => ({ ...b, wip_count: Math.round(b.wip_count / 2) })),
    }

    const outcome = compareDemoState(before, after)

    expect(outcome.headline?.key).toBe('leadTime')
    expect(outcome.headline?.improved).toBe(true)
  })

  it('vergleicht nicht gegen eine unbekannte Groesse', () => {
    const before = demo()
    // Ohne Stationen *und* ohne Kundenbedarf gibt es keine Rate, mit der sich
    // Little's Law rechnen liesse: Die Durchlaufzeit ist dann unbekannt und
    // nicht null. Ueber eine unbekannte Groesse laesst sich nichts behaupten.
    //
    // Nur die Stationen zu loeschen genuegt dafuer nicht — der Kundenbedarf
    // bleibt eine gueltige Abgangsrate, und ein Strom ohne Bestand hat
    // tatsaechlich eine Durchlaufzeit von null Tagen.
    const after: VsmState = {
      ...before,
      project: { ...before.project, annual_throughput: null },
      processes: [],
      buffers: [],
    }

    const outcome = compareDemoState(before, after)

    expect(kpisForState(after).totalLeadTimeDays).toBeNull()
    expect(outcome.metrics.some((m) => m.key === 'leadTime')).toBe(false)
  })

  it('gibt die Kennzahlen in fester Reihenfolge zurueck', () => {
    const before = demo()
    const after = withCycleTime(before, 1, 1.6)

    const keys = compareDemoState(before, after).metrics.map((m) => m.key)

    expect(keys).toEqual([...keys].sort((a, b) => {
      const order = ['leadTime', 'valueAddedRatio', 'exitRate']
      return order.indexOf(a) - order.indexOf(b)
    }))
  })
})
