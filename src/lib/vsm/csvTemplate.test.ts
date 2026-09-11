import { describe, expect, it } from 'vitest'
import { buildCsvTemplate, TEMPLATE_DELIMITER, UTF8_BOM } from './csvTemplate'
import { ALL_COLUMNS, parseProcessesCsv } from './csvImport'

describe('buildCsvTemplate', () => {
  // Ohne BOM liest Excel die Datei als Windows-1252 und macht aus "Saegen" ein
  // "SÃ¤gen".
  it('starts with a UTF-8 BOM', () => {
    expect(buildCsvTemplate().startsWith(UTF8_BOM)).toBe(true)
  })

  it('writes every column the importer can read, in order', () => {
    const header = buildCsvTemplate().replace(UTF8_BOM, '').split('\n')[0]
    expect(header).toBe(ALL_COLUMNS.join(TEMPLATE_DELIMITER))
  })

  // Deutsches Excel oeffnet eine Komma-CSV als eine einzige Spalte.
  it('separates with semicolons', () => {
    expect(buildCsvTemplate()).toContain(';')
  })

  /**
   * Der eigentliche Test dieser Datei: Was die Vorlage schreibt, muss der
   * Importer lesen koennen. Laufen die beiden auseinander, faellt es hier auf
   * und nicht erst im Workshop.
   */
  it('round-trips through the importer', () => {
    const rows = parseProcessesCsv(buildCsvTemplate())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      name: 'Beispiel: Drehen',
      cycleTime: 3.4,
      changeoverTime: 15,
      oee: 78,
      operatorCount: 1,
      wip: 0,
      wipAfter: 120,
    })
  })
})
