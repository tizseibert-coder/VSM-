import { describe, expect, it } from 'vitest'
import {
  DEMO_TRANSFER_MAX_AGE_MS,
  DEMO_TRANSFER_VERSION,
  MAX_PROCESSES,
  MAX_SERIALIZED_BYTES,
  parseSerializedTransfer,
  parseTransfer,
  toTransfer,
  fromTransfer,
} from './demoTransfer'
import { buildDemoState, DEMO_LABELS_DE } from './demoProject'

/**
 * Was hier zurueckkommt, war im Browser des Nutzers und kommt ueber ein
 * Formularfeld an den Server. Es ist fremde Eingabe, auch wenn wir es selbst
 * geschrieben haben — diese Tests halten fest, dass `parseTransfer` nichts
 * ergaenzt und nichts raet.
 */

const NOW = 1_800_000_000_000

function demoTransfer() {
  return toTransfer(buildDemoState(DEMO_LABELS_DE), NOW)
}

describe('toTransfer', () => {
  it('nimmt den Demo-Wertstrom vollstaendig mit', () => {
    const t = demoTransfer()

    expect(t.version).toBe(DEMO_TRANSFER_VERSION)
    expect(t.processes).toHaveLength(5)
    expect(t.processes[0].name).toBe('Sägen')
    expect(t.processes[1].cycleTime).toBe(3.4)
    expect(t.processes[4].operatorCount).toBe(2)
    expect(t.annualThroughput).toBe(50000)
    expect(t.availableMinutesPerDay).toBe(480)
  })

  it('verweist von Bestaenden auf Stationen ueber die Position, nicht ueber die Id', () => {
    const t = demoTransfer()

    // Die Ids der Demo ("demo-p1") gibt es serverseitig nicht.
    for (const b of t.buffers) {
      if (b.fromIndex !== null) expect(t.processes[b.fromIndex]).toBeDefined()
      if (b.toIndex !== null) expect(t.processes[b.toIndex]).toBeDefined()
    }
    // Der erste Bestand haengt vor der ersten Station.
    expect(t.buffers[0].fromIndex).toBeNull()
    expect(t.buffers[0].toIndex).toBe(0)
  })

  it('ueberlebt eine Rundreise durch JSON unveraendert', () => {
    const t = demoTransfer()
    expect(parseTransfer(JSON.parse(JSON.stringify(t)), NOW)).toEqual(t)
  })
})

describe('parseTransfer — was nicht durchkommt', () => {
  it('weist alles zurueck, was kein Objekt ist', () => {
    for (const bad of [null, undefined, 42, 'text', [], true]) {
      expect(parseTransfer(bad, NOW)).toBeNull()
    }
  })

  it('weist eine andere Fassung zurueck', () => {
    expect(parseTransfer({ ...demoTransfer(), version: 99 }, NOW)).toBeNull()
  })

  it('weist Abgelaufenes zurueck', () => {
    const t = demoTransfer()
    const spaeter = NOW + DEMO_TRANSFER_MAX_AGE_MS + 1

    expect(parseTransfer(t, spaeter)).toBeNull()
    // Eine Stunde vor Ablauf geht noch.
    expect(parseTransfer(t, NOW + DEMO_TRANSFER_MAX_AGE_MS - 3600_000)).not.toBeNull()
  })

  it('weist einen Zeitstempel aus der Zukunft zurueck', () => {
    // Verstellte Uhr oder manipuliertes Feld — ein Eintrag, der nie ablaeuft.
    expect(parseTransfer({ ...demoTransfer(), savedAt: NOW + 5 * 24 * 3600_000 }, NOW)).toBeNull()
  })

  it('weist einen Wertstrom ohne Stationen zurueck', () => {
    expect(parseTransfer({ ...demoTransfer(), processes: [] }, NOW)).toBeNull()
    expect(parseTransfer({ ...demoTransfer(), processes: 'keine' }, NOW)).toBeNull()
  })
})

describe('parseTransfer — was zurechtgebogen wird', () => {
  it('deckelt eine unmoegliche OEE statt die Uebernahme zu verweigern', () => {
    // "850" fuer "85" ist ein Eingabefehler, kein Angriff. Der Nutzer soll
    // seinen Wertstrom bekommen — nur eben mit 100.
    const t = { ...demoTransfer() }
    t.processes = [{ ...t.processes[0], oee: 850 }]

    expect(parseTransfer(t, NOW)!.processes[0].oee).toBe(100)
  })

  it('faengt NaN und Unendlich ab', () => {
    const t = { ...demoTransfer() }
    // Aus JSON kommt das nicht heraus, aus einem von Hand gebauten Feld schon.
    t.processes = [{ ...t.processes[0], cycleTime: Infinity, wip: Number.NaN }]

    const parsed = parseTransfer(t, NOW)!
    expect(Number.isFinite(parsed.processes[0].cycleTime)).toBe(true)
    // Nicht auf die Obergrenze gedeckelt, sondern auf die Vorgabe: Aus einer
    // unendlichen Zykluszeit 100.000 zu machen hiesse, einen Riesenwert zu
    // erfinden, den niemand eingetippt hat. Eine echte, aber zu grosse Zahl
    // wird dagegen gedeckelt — siehe die Zeile darunter.
    expect(parsed.processes[0].cycleTime).toBe(0)
    expect(parsed.processes[0].wip).toBe(0)
  })

  it('deckelt eine echte, aber zu grosse Zahl auf die Obergrenze', () => {
    const t = { ...demoTransfer() }
    t.processes = [{ ...t.processes[0], cycleTime: 9_999_999 }]

    expect(parseTransfer(t, NOW)!.processes[0].cycleTime).toBe(100_000)
  })

  it('begrenzt die Zahl der Stationen', () => {
    const t = { ...demoTransfer() }
    t.processes = Array.from({ length: 500 }, (_, i) => ({ ...t.processes[0], name: `S${i}` }))

    expect(parseTransfer(t, NOW)!.processes).toHaveLength(MAX_PROCESSES)
  })

  it('wirft Bestaende weg, die auf eine Station ausserhalb der Kette zeigen', () => {
    const t = { ...demoTransfer() }
    t.processes = [t.processes[0]]
    t.buffers = [{ ...t.buffers[0], fromIndex: 99, toIndex: -3 }]

    const b = parseTransfer(t, NOW)!.buffers[0]
    expect(b.fromIndex).toBeNull()
    expect(b.toIndex).toBeNull()
  })

  it('laesst nur bekannte Bestandsarten und Flussarten durch', () => {
    const t = { ...demoTransfer() }
    t.buffers = [
      { ...t.buffers[0], bufferType: 'supermarket', flowStyle: 'pull' },
      { ...t.buffers[0], bufferType: '<script>', flowStyle: 'schnell' },
    ]

    const parsed = parseTransfer(t, NOW)!
    expect(parsed.buffers[0].bufferType).toBe('supermarket')
    expect(parsed.buffers[0].flowStyle).toBe('pull')
    expect(parsed.buffers[1].bufferType).toBeNull()
    expect(parsed.buffers[1].flowStyle).toBeNull()
  })

  it('laesst hoechstens einen Schrittmacher stehen', () => {
    // Die Anwendung setzt die Regel ohnehin durch; ein Feld mit drei
    // Schrittmachern haette einen Zustand erzeugt, den sie nie herstellt.
    const t = { ...demoTransfer() }
    t.processes = t.processes.map((p) => ({ ...p, isPacemaker: true }))

    const parsed = parseTransfer(t, NOW)!
    expect(parsed.processes.filter((p) => p.isPacemaker)).toHaveLength(1)
    expect(parsed.processes[0].isPacemaker).toBe(true)
  })

  it('faellt bei einer unsinnigen Waehrung auf EUR zurueck', () => {
    // Der Wert geht in eine Waehrungsformatierung und wuerde dort werfen.
    expect(parseTransfer({ ...demoTransfer(), currency: 'Taler' }, NOW)!.currency).toBe('EUR')
    expect(parseTransfer({ ...demoTransfer(), currency: 'CHF' }, NOW)!.currency).toBe('CHF')
  })

  it('kuerzt ueberlange Namen, statt sie abzulehnen', () => {
    const t = { ...demoTransfer() }
    t.projectName = 'x'.repeat(5000)

    expect(parseTransfer(t, NOW)!.projectName).toHaveLength(200)
  })

  it('gibt einer namenlosen Station einen Platzhalter', () => {
    const t = { ...demoTransfer() }
    t.processes = [{ ...t.processes[0], name: '   ' }]

    expect(parseTransfer(t, NOW)!.processes[0].name).toBe('1')
  })
})

describe('parseSerializedTransfer', () => {
  it('liest die eigene Ausgabe zurueck', () => {
    const t = demoTransfer()
    expect(parseSerializedTransfer(JSON.stringify(t), NOW)).toEqual(t)
  })

  it('gibt bei kaputtem JSON null zurueck, statt zu werfen', () => {
    // Ein halb geschriebener localStorage-Eintrag ist kein Grund fuer eine
    // Fehlerseite.
    expect(parseSerializedTransfer('{"version":1,', NOW)).toBeNull()
    expect(parseSerializedTransfer('', NOW)).toBeNull()
    expect(parseSerializedTransfer(null, NOW)).toBeNull()
  })

  it('weist zu Grosses ab, bevor es geparst wird', () => {
    const huge = JSON.stringify({ pad: 'x'.repeat(MAX_SERIALIZED_BYTES) })
    expect(huge.length).toBeGreaterThan(MAX_SERIALIZED_BYTES)
    expect(parseSerializedTransfer(huge, NOW)).toBeNull()
  })
})

describe('fromTransfer', () => {
  it('macht aus dem gespeicherten Stand wieder einen bedienbaren Zustand', () => {
    const original = buildDemoState(DEMO_LABELS_DE)
    const wieder = fromTransfer(toTransfer(original, NOW), original)

    // Alles, was der Nutzer sieht und aendern kann, kommt zurueck.
    expect(wieder.project.name).toBe(original.project.name)
    expect(wieder.project.annual_throughput).toBe(original.project.annual_throughput)
    expect(wieder.project.available_minutes_per_day).toBe(
      original.project.available_minutes_per_day
    )
    expect(wieder.processes.map((p) => p.name)).toEqual(original.processes.map((p) => p.name))
    expect(wieder.processes.map((p) => p.cycle_time)).toEqual(
      original.processes.map((p) => p.cycle_time)
    )
    expect(wieder.processes.map((p) => p.operator_count)).toEqual(
      original.processes.map((p) => p.operator_count)
    )
    expect(wieder.buffers.map((b) => b.wip_count)).toEqual(
      original.buffers.map((b) => b.wip_count)
    )
  })

  it('knuepft die Bestaende wieder an die richtigen Stationen', () => {
    const original = buildDemoState(DEMO_LABELS_DE)
    const wieder = fromTransfer(toTransfer(original, NOW), original)

    // Die Ids sind neu, die Kette ist dieselbe: Position vor Position.
    const kette = (state: typeof original) =>
      state.buffers.map((b) => [
        b.from_process_id ? state.processes.findIndex((p) => p.id === b.from_process_id) : null,
        b.to_process_id ? state.processes.findIndex((p) => p.id === b.to_process_id) : null,
      ])

    expect(kette(wieder)).toEqual(kette(original))
    // Und es sind wirklich andere Ids — der Datensatz wurde neu aufgebaut.
    expect(wieder.processes[0].id).not.toBe(original.processes[0].id)
  })

  it('haelt den Schrittmacher und die Bestandsart fest', () => {
    const original = buildDemoState(DEMO_LABELS_DE)
    const wieder = fromTransfer(toTransfer(original, NOW), original)

    expect(wieder.processes.filter((p) => p.is_pacemaker)).toHaveLength(1)
    expect(wieder.processes[4].is_pacemaker).toBe(true)
    expect(wieder.buffers[4].buffer_type).toBe('supermarket')
  })

  it('nimmt eine Aenderung mit, statt den Ausgangsdatensatz zurueckzugeben', () => {
    const original = buildDemoState(DEMO_LABELS_DE)
    const geaendert = {
      ...original,
      processes: original.processes.map((p, i) => (i === 1 ? { ...p, cycle_time: 1.6 } : p)),
    }

    const wieder = fromTransfer(toTransfer(geaendert, NOW), original)

    expect(wieder.processes[1].cycle_time).toBe(1.6)
    expect(original.processes[1].cycle_time).toBe(3.4)
  })
})
