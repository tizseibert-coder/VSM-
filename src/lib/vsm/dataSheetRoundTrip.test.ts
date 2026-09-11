// Der Weg, den ein Erhebungsbogen wirklich nimmt: herunterladen, in Excel
// ausfuellen, speichern, importieren. Jedes Stueck davon ist einzeln getestet
// — dieser Test prueft, dass sie zusammenpassen.
//
// Er haelt vor allem einen Fehler fest, der lange drin war: importProcessesCsv
// legte nur Prozesse an und keine Puffer. Die Kette blieb leer, damit der
// Bestand 0 und die Durchlaufzeit 0 Tage. Ein Wertstrom, der nichts aussagt.

import { describe, expect, it } from 'vitest'
import { buildCsvTemplate } from '@/lib/vsm/csvTemplate'
import { parseProcessesCsv } from '@/lib/vsm/csvImport'
import { chainToEdges } from '@/lib/vsm/chainOrder'
import { calculateKpis } from '@/lib/vsm/calculations'

describe('Der Weg vom Bogen zum Wertstrom', () => {
  it('ergibt eine verbundene Kette mit Durchlaufzeit', () => {
    // Was der Nutzer herunterlaedt, in Excel ausfuellt und speichert:
    // Semikolon, Dezimalkomma, BOM, eine nicht ausgefuellte Restzeile.
    const filled =
      buildCsvTemplate().split('\n')[0] +
      '\n' +
      ['Saegen;1,2;5;82;1;0;3200', 'Drehen;3,4;15;78;2;0;2100', 'Fraesen;2,6;20;85;1;0;900', ';;;;;;'].join('\n')

    const rows = parseProcessesCsv(filled)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual({
      name: 'Drehen',
      cycleTime: 3.4,
      changeoverTime: 15,
      oee: 78,
      operatorCount: 2,
      wip: 0,
      wipAfter: 2100,
    })

    // Die Kette, die der Import daraus baut.
    const ids = rows.map((_, i) => `p${i}`)
    const edges = chainToEdges(ids)
    expect(edges).toHaveLength(4) // Lieferant, zwei Luecken, Kunde

    // Puffer bekommen den "WIP danach" der Station, aus der die Kante kommt.
    const wipAfterOf = new Map(ids.map((id, i) => [id, rows[i].wipAfter ?? 0]))
    const buffers = edges.map((e) => ({
      wipCount: e.from !== null ? (wipAfterOf.get(e.from) ?? 0) : 0,
    }))
    expect(buffers.map((b) => b.wipCount)).toEqual([0, 3200, 2100, 900])

    const kpis = calculateKpis({
      processes: rows.map((r) => ({
        cycleTime: r.cycleTime,
        oee: r.oee,
        operatorCount: r.operatorCount,
        wip: r.wip,
      })),
      buffers,
      annualThroughput: 50000,
      availableMinutesPerDay: 480,
    })

    // Der eigentliche Punkt: Vor dieser Aenderung gab es keine Puffer, damit
    // WIP 0 und eine Durchlaufzeit von 0 Tagen.
    expect(kpis.totalWipCount).toBe(6200)
    expect(kpis.totalLeadTimeDays).not.toBeNull()
    expect(kpis.totalLeadTimeDays!).toBeGreaterThan(0)
  })
})
