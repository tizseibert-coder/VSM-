// Der Erhebungsbogen als Datei — dieselbe Tabelle, die unter /data-sheet aufs
// Klemmbrett gedruckt wird, nur zum Ausfuellen in Excel.
//
// Die Spalten kommen aus csvImport.ts und werden hier nicht wiederholt. Das
// ist der ganze Zweck dieser Datei: Eine Vorlage, deren Spalten der Importer
// nicht kennt, ist schlimmer als keine — sie sieht aus, als wuerde sie
// funktionieren, und verliert die Haelfte der erhobenen Zahlen stillschweigend.

import { ALL_COLUMNS } from './csvImport'

/**
 * Semikolon, nicht Komma.
 *
 * Deutsches Excel oeffnet eine Komma-CSV als eine einzige Spalte — der
 * Ausfuellende sieht dann "Saegen,1.2,15,..." in Zelle A1 und ist raus.
 * `parseProcessesCsv` liest beide Trenner, geschrieben wird der, der im
 * Zielprogramm ankommt.
 */
export const TEMPLATE_DELIMITER = ';'

/**
 * Byte Order Mark.
 *
 * Ohne sie liest Excel die Datei als Windows-1252 und macht aus "Saegen" ein
 * "SÃ¤gen". Drei Bytes, die den Unterschied zwischen brauchbar und
 * unbrauchbar ausmachen.
 */
export const UTF8_BOM = '﻿'

/**
 * Eine Beispielzeile, damit sichtbar ist, was in welche Spalte gehoert.
 *
 * Bewusst *eine* und mit erkennbar erfundenen Werten: Wer sie ueberschreibt,
 * hat die Vorlage verstanden; wer sie stehen laesst, sieht im Wertstrom sofort
 * eine Station namens "Beispiel" und weiss, dass er sie loeschen muss. Ein
 * leeres Blatt beantwortet dagegen nicht, ob die Zykluszeit in Minuten oder
 * Sekunden gehoert.
 */
const EXAMPLE_ROW: Record<string, string> = {
  name: 'Beispiel: Drehen',
  cycle_time: '3,4',
  changeover_time: '15',
  oee: '78',
  operator_count: '1',
  wip: '0',
  wip_after: '120',
}

/**
 * Der Inhalt der Vorlagendatei: BOM, Kopfzeile, eine Beispielzeile.
 *
 * Reine Zeichenkette und kein Blob — so ist sie ohne Browser pruefbar, und der
 * Knopf drumherum macht nur noch den Download daraus.
 */
export function buildCsvTemplate(): string {
  const header = ALL_COLUMNS.join(TEMPLATE_DELIMITER)
  const example = ALL_COLUMNS.map((column) => EXAMPLE_ROW[column] ?? '').join(TEMPLATE_DELIMITER)
  return `${UTF8_BOM}${header}\n${example}\n`
}

/** Dateiname des Downloads. Ohne Datum: Die Vorlage ist leer, sie altert nicht. */
export const CSV_TEMPLATE_FILENAME = 'erhebungsbogen.csv'
