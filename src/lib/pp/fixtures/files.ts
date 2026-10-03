// Testdaten — die erfundene Firma in Dateiform: Tabellenzeilen, wie sie aus
// dem SAP-Ruestplan und aus der Schichtplan-Vorlage kommen.
//
// Zeilen statt fertiger xlsx-Dateien: Die Parser arbeiten auf Zeilen, und so
// laesst sich jedes Format pruefen, ohne eine Datei zu schreiben. Die
// xlsx-Huelle (und der Streaming-Modus) kommt dazu, sobald eine
// xlsx-Bibliothek eingebunden ist.

import { addDays, parseIsoDay } from '../dates'
import type { FixtureDay, FixtureFactory } from './generator'

const EMPTY = ''

function swiss(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

/** Ein SAP-Ruestplan fuer einen Tag der Testfirma, Block je Ruestung. */
export function setupPlanRows(factory: FixtureFactory, day: FixtureDay): string[][] {
  const rows: string[][] = [[swiss(day.day)]]
  const shifts = factory.settings.shifts
    .filter((s) => s.kind === 'work' && s.startMinutes !== undefined)
    .sort((a, b) => (a.startMinutes as number) - (b.startMinutes as number))

  day.planned.forEach((item, i) => {
    const [date, time] = item.plannedStart.split('T')
    const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    const shiftNumber = Math.max(1, shifts.findIndex((s) => minutes >= (s.startMinutes as number) && minutes < (s.startMinutes as number) + s.hours * 60) + 1)
    const article = factory.articles.find((a) => a.number === item.article)
    // Vorgaenger: ein anderer Artikel derselben Maschine; jede vierte Ruestung
    // behaelt das Werkzeug (reiner Materialwechsel).
    const before = factory.articles[(factory.articles.indexOf(article!) + 1) % factory.articles.length]
    const toolBefore = i % 4 === 0 ? item.tool : before.tool
    rows.push(
      [`${swiss(date)} ${time} Schicht ${shiftNumber}`, EMPTY, EMPTY, `Auftrag ${4000 + i}`, EMPTY, EMPTY, EMPTY, `Vorgänger ${3000 + i}`],
      [EMPTY, 'Maschine', EMPTY, item.machine],
      [EMPTY, 'disponiert', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, `bis ${swiss(date)} ${time}`],
      [EMPTY, 'Werkzeug', EMPTY, item.tool, EMPTY, EMPTY, EMPTY, toolBefore],
      [EMPTY, 'Artikel', EMPTY, item.article, EMPTY, EMPTY, EMPTY, before.number],
      [EMPTY, 'Kurztext', EMPTY, article?.description ?? EMPTY, EMPTY, EMPTY, EMPTY, before.description],
      [EMPTY, 'Material', EMPTY, `MAT-${item.article.slice(-3)}`, EMPTY, EMPTY, EMPTY, `MAT-${before.number.slice(-3)}`],
    )
  })
  return rows
}

/**
 * Die Schichtplan-Vorlage der Testfirma: drei Kopfzeilen, Datumszeile mit
 * Excel-Seriennummern, Wochentagszeile mit einer „Kommentar"-Spalte je Woche,
 * dann eine Person je Zeile. Statt Namen stehen die Kuerzel drin — auch eine
 * Testdatei soll keine Namen tragen.
 */
export function shiftPlanRows(factory: FixtureFactory): unknown[][] {
  const labels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const dateRow: unknown[] = [EMPTY, EMPTY, EMPTY]
  const dayRow: unknown[] = ['Team', EMPTY, 'Name']
  const weeks = factory.people[0]?.weeks ?? []
  for (const week of weeks) {
    for (let d = 0; d < 7; d++) {
      dateRow.push(serial(addDays(week.sunday, d)))
      dayRow.push(labels[d])
    }
    dateRow.push(EMPTY)
    dayRow.push('Kommentar')
  }
  const people = factory.people.map((p) => {
    const row: unknown[] = [p.team, EMPTY, p.kuerzel]
    for (const week of p.weeks) {
      row.push(...week.codes.map((c) => c ?? EMPTY), EMPTY)
    }
    return row
  })
  return [['Schichtplan'], [], [], dateRow, dayRow, ...people, [EMPTY, EMPTY, 'Frühschicht']]
}

function serial(day: string): number {
  return (parseIsoDay(day).getTime() - Date.UTC(1899, 11, 30)) / 86_400_000
}
