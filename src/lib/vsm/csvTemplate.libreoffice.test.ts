import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCsvTemplate } from './csvTemplate'
import { parseProcessesCsv } from './csvImport'

/**
 * Der Erhebungsbogen durch ein echtes Tabellenprogramm.
 *
 * Alle anderen Tests pruefen die Vorlage gegen den eigenen Parser — die beiden
 * koennen sich einig und trotzdem beide falsch sein. Ob ein Tabellenprogramm
 * die Datei richtig oeffnet, entscheidet sich an vier Dingen, und dieser Test
 * ist der einzige, der sie wirklich beruehrt:
 *
 *   Trennzeichen  Deutsches Excel oeffnet eine Komma-CSV als *eine* Spalte.
 *   BOM           Ohne sie wird aus "Saegen" ein "SÃ¤gen".
 *   Zeichensatz   UTF-8 muss als solches erkannt werden.
 *   Dezimalkomma  "3,4" muss dreieinhalb bleiben und nicht zu zwei Spalten
 *                 werden.
 *
 * LibreOffice ist nicht Excel, faellt aber ueber dieselben vier.
 */

/** Ein Ordner je Aufruf, Ein- und Ausgabe getrennt. */
function scratch(): { input: string; output: string } {
  const base = mkdtempSync(join(tmpdir(), 'bogen-'))
  const input = join(base, 'in')
  const output = join(base, 'out')
  mkdirSync(input)
  mkdirSync(output)
  return { input, output }
}

function convert(soffice: string, file: string, outdir: string): void {
  execFileSync(
    soffice,
    [
      '--headless',
      '--norestore',
      // 59/34/76/1: Semikolon als Trenner, Anfuehrungszeichen, UTF-8, erste
      // Tabelle.
      //
      // Zweimal, und das ist der Punkt: `--convert-to` beschreibt nur, wie
      // geschrieben wird. Wie *gelesen* wird, steht in `--infilter`, und ohne
      // die Angabe raet LibreOffice im Stapelbetrieb Komma. Aus der einen
      // Kopfzeile wird dann eine einzige Zelle und aus der Zykluszeit "3,4"
      // werden zwei Spalten — genau der Fehler, gegen den diese Datei
      // geschrieben ist, nur eben im Test statt im Erzeugnis.
      // Mit Gleichheitszeichen und als *ein* Argument: Getrennt uebergeben
      // druckt soffice seine Kurzhilfe und schreibt gar nichts — was der Test
      // als "LibreOffice nicht benutzbar" lesen und sich selbst ueberspringen
      // wuerde.
      '--infilter=CSV:59,34,76,1',
      '--convert-to',
      'csv:Text - txt - csv (StarCalc):59,34,76,1,,0,false,true,true',
      '--outdir',
      outdir,
      file,
    ],
    { encoding: 'utf8', timeout: 120_000, stdio: 'pipe' }
  )
}

/**
 * Laesst sich LibreOffice hier ueberhaupt benutzen?
 *
 * `which soffice` genuegt als Bedingung nicht: In manchen Umgebungen liegt die
 * Binaerdatei da und scheitert trotzdem an jeder Datei ("source file could not
 * be loaded"). Ein Test, der das nicht bemerkt, liest im Zweifel seine eigene
 * Eingabe zurueck und meldet gruen — dieser Fall ist beim Schreiben hier
 * tatsaechlich eingetreten. Deshalb wird einmal wirklich umgewandelt und
 * geprueft, ob dabei etwas herauskommt.
 */
function usableSoffice(): string | null {
  let path: string
  try {
    path = execFileSync('which', ['soffice'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
  if (!path) return null

  try {
    const { input, output } = scratch()
    const probe = join(input, 'probe.csv')
    writeFileSync(probe, 'a;b\n1;2\n', 'utf8')
    convert(path, probe, output)
    return readdirSync(output).length > 0 ? path : null
  } catch {
    return null
  }
}

const soffice = usableSoffice()

describe.skipIf(!soffice)('Der Bogen durch LibreOffice', () => {
  it('überlebt Öffnen und Speichern in einem echten Tabellenprogramm', () => {
    const { input, output } = scratch()
    const source = join(input, 'erhebungsbogen.csv')
    writeFileSync(source, buildCsvTemplate(), 'utf8')

    convert(soffice!, source, output)

    // Getrennte Ordner, damit hier unmoeglich die Eingabe zurueckgelesen
    // werden kann — genau das machte eine fruehere Fassung dieses Tests gruen,
    // obwohl die Umwandlung gescheitert war.
    const written = readdirSync(output)
    expect(written, 'LibreOffice hat keine Datei geschrieben').not.toEqual([])

    const rows = parseProcessesCsv(readFileSync(join(output, written[0]), 'utf8'))

    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Beispiel: Drehen')
    // Die Dezimalprobe: Aus "3,4" darf keine 34 und keine zweite Spalte werden.
    expect(rows[0].cycleTime).toBe(3.4)
    expect(rows[0].wipAfter).toBe(120)
  })
})
