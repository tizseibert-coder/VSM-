// Testdaten — eine erfundene Spritzguss-Firma mit Schichtplan, Ruestplaenen
// und Tageswerten.
//
// Kein einziger Wert stammt aus einem echten Werk (docs/plan-tagesplanung-
// modul.md, „Testdaten statt echter Daten"). Nummern folgen nur dem *Muster*
// echter Exporte, damit Import und Formaterkennung realistisch geprueft
// werden. Kuerzel statt Namen, wie im Werkzeug selbst.
//
// Die Rohcodes im Schichtplan sind absichtlich die der Datei, nicht die
// gespeicherten: krank/Ferien (k/h) und ein paar unbekannte Codes stehen
// drin, damit normalizeRosterCode etwas zu tun hat.

import { addDays, formatIsoDay, parseIsoDay, weekdaySundayFirst } from '../dates'
import type { ActualChangeover, PlannedChangeover } from '../execution'
import { estimateUtHours } from '../kpi'
import { normalizeRosterCode, plannedOtHoursForDay, pvHoursForDay, type RosterEntry } from '../shifts'
import { DEFAULT_SETTINGS, type PpSettings } from '../settings'
import { createRandom, type Random } from './random'

export interface FixtureMachine {
  id: string
  team: string
}

export interface FixtureArticle {
  number: string
  description: string
  tool: string
  cycleTimeSeconds: number
  cavities: number
}

export interface FixturePerson {
  kuerzel: string
  team: string
  /** Rollen-Code; die Testfirma bringt eigene Rollen mit (FIXTURE_ROLES). */
  role: string
  /** Woche fuer Woche, Sonntag zuerst — wie die Schichtplan-Vorlage. */
  weeks: { sunday: string; codes: (string | null)[] }[]
}

export interface FixtureDay {
  day: string
  /** Rollengewichtete OT-Planung des Tages. */
  otPlan: number
  /** Vorgabe-UT aus Plan (Zykluszeit × Menge); null an Tagen ohne Zykluszeiten. */
  utPlanned: number | null
  /** null = an diesem Tag nicht erfasst (Luecke). */
  utActual: number | null
  pvPlan: number
  otActual: number | null
  planned: (PlannedChangeover & { tool: string; quantity: number; durationMin: number })[]
  actual: ActualChangeover[]
}

export interface FixtureFactory {
  settings: PpSettings
  machines: FixtureMachine[]
  articles: FixtureArticle[]
  people: FixturePerson[]
  days: FixtureDay[]
}

export interface FactoryOptions {
  seed?: number
  /** Erster Produktionstag, ISO. */
  startDay?: string
  /** Wie viele Kalendertage Daten erzeugt werden (0 = nur Stammdaten und Schichtplan). */
  days?: number
  machines?: number
  /** Wochen im Schichtplan; die Vorlage hat 53. */
  rosterWeeks?: number
  settings?: PpSettings
}

const TEAMS = ['A', 'B', 'C']

/**
 * Erfundene Rollen der Testfirma — bewusst andere Gewichte als in jedem echten
 * Werk, damit kein Test still auf Werkswerten aufbaut.
 */
export const FIXTURE_ROLES = [
  { code: 'setter', label: 'Einrichter', weight: 1 },
  { code: 'helper', label: 'Unterstützung', weight: 0.5 },
  { code: 'trainee', label: 'Lernende', weight: 0.5 },
  { code: 'other', label: 'Übrige', weight: 0 },
]
const DESCRIPTIONS = ['Gehäuse oben', 'Gehäuse unten', 'Deckel', 'Rahmen', 'Abdeckung', 'Clip', 'Träger', 'Blende']

export function generateFactory(options: FactoryOptions = {}): FixtureFactory {
  const rnd = createRandom(options.seed ?? 4711)
  const settings = options.settings ?? { ...DEFAULT_SETTINGS, roles: FIXTURE_ROLES }
  const startDay = options.startDay ?? '2026-01-05'
  const machineCount = options.machines ?? 8

  const machines: FixtureMachine[] = Array.from({ length: machineCount }, (_, i) => ({
    id: `T${String(30 + i).padStart(3, '0')}-A${String((i % 4) + 1).padStart(2, '0')}`,
    team: TEAMS[i % TEAMS.length],
  }))
  const articles: FixtureArticle[] = Array.from({ length: machineCount * 3 }, (_, i) => ({
    number: String(900_000 + i * 37),
    description: DESCRIPTIONS[i % DESCRIPTIONS.length],
    tool: `W-${String(500 + i)}`,
    cycleTimeSeconds: Math.round(rnd.between(18, 55)),
    cavities: rnd.pick([1, 2, 4, 8]),
  }))

  const people = generateRoster(rnd, startDay, options.rosterWeeks ?? 53)
  const entries = rosterEntries(people, settings)
  const days: FixtureDay[] = []
  for (let i = 0; i < (options.days ?? 0); i++) {
    days.push(generateDay(rnd, addDays(startDay, i), machines, articles, entries, settings))
  }
  return { settings, machines, articles, people, days }
}

function generateRoster(rnd: Random, startDay: string, weeks: number): FixturePerson[] {
  const firstSunday = addDays(startDay, -weekdaySundayFirst(startDay))
  const rotation = ['f', 's', 'n']
  const people: FixturePerson[] = []
  const used = new Set<string>()
  for (let p = 0; p < 18; p++) {
    let kuerzel = ''
    do kuerzel = Array.from({ length: 3 }, () => String.fromCharCode(65 + rnd.int(0, 25))).join('')
    while (used.has(kuerzel))
    used.add(kuerzel)
    const team = TEAMS[p % TEAMS.length]
    const partTime = p === 17
    const role = p % 6 < 3 ? 'setter' : p % 6 === 3 ? 'helper' : p % 6 === 4 ? 'trainee' : 'other'
    const person: FixturePerson = { kuerzel, team, role, weeks: [] }
    for (let w = 0; w < weeks; w++) {
      const sunday = addDays(firstSunday, w * 7)
      const shift = rotation[(TEAMS.indexOf(team) + w) % rotation.length]
      const holidayWeek = rnd.chance(0.06)
      const codes: (string | null)[] = []
      for (let d = 0; d < 7; d++) {
        // Woche So 22:00 bis Fr 22:00: Nacht beginnt am Sonntag, endet in der
        // Nacht auf Samstag; Frueh und Spaet laufen Mo–Fr.
        const works = shift === 'n' ? d >= 0 && d <= 4 : d >= 1 && d <= 5
        if (!works) codes.push(null)
        else if (holidayWeek) codes.push('h')
        else if (rnd.chance(0.04)) codes.push('k')
        else if (rnd.chance(0.005)) codes.push(rnd.pick(['x', 'u']))
        else codes.push(partTime ? 't' : shift)
      }
      person.weeks.push({ sunday, codes })
    }
    people.push(person)
  }
  return people
}

function rosterEntries(people: readonly FixturePerson[], settings: PpSettings): RosterEntry[] {
  const entries: RosterEntry[] = []
  for (const person of people) {
    for (const week of person.weeks) {
      week.codes.forEach((raw, d) => {
        const code = normalizeRosterCode(raw, settings.shifts, settings.importCodeMap)
        if (code?.known) entries.push({ day: addDays(week.sunday, d), code: code.code, role: person.role })
      })
    }
  }
  return entries
}

function generateDay(
  rnd: Random,
  day: string,
  machines: readonly FixtureMachine[],
  articles: readonly FixtureArticle[],
  roster: readonly RosterEntry[],
  settings: PpSettings,
): FixtureDay {
  const pvPlan = pvHoursForDay(roster, day, settings.shifts)
  const otPlan = plannedOtHoursForDay(roster, day, settings.shifts, settings.roles)
  const weekday = weekdaySundayFirst(day)
  if (weekday === 0 || weekday === 6) {
    return { day, otPlan, utPlanned: null, utActual: null, pvPlan, otActual: null, planned: [], actual: [] }
  }

  const workShifts = settings.shifts.filter((s) => s.kind === 'work' && s.startMinutes !== undefined)
  const planned: FixtureDay['planned'] = []
  const actual: ActualChangeover[] = []
  let utPlanned = 0
  machines.forEach((machine, mi) => {
    const article = articles[(mi * 3 + rnd.int(0, 2)) % articles.length]
    // Volle Laufzeit ueber 24 h, abzueglich der Ruestung, als Vorgabe.
    const shots = (22 * 3600) / article.cycleTimeSeconds
    utPlanned += estimateUtHours({ goodParts: shots * article.cavities, cycleTimeSeconds: article.cycleTimeSeconds, cavities: article.cavities })

    if (!rnd.chance(0.55)) return
    const shift = rnd.pick(workShifts)
    const startMin = (shift.startMinutes as number) + rnd.int(30, Math.max(31, shift.hours * 60 - 90))
    const plannedStart = wallClock(day, startMin)
    const item = {
      id: `${day}-${machine.id}`,
      machine: machine.id,
      article: article.number,
      plannedStart,
      tool: article.tool,
      quantity: Math.round(shots * article.cavities * 0.5),
      durationMin: rnd.pick([45, 60, 90, 120]),
    }
    planned.push(item)

    if (rnd.chance(0.1)) return // nicht ausgefuehrt
    const wrongShift = rnd.chance(0.08)
    const offset = wrongShift ? shift.hours * 60 : Math.round(rnd.normal(10, 20))
    actual.push({ machine: item.machine, article: item.article, actualStart: wallClock(day, startMin + offset) })
  })
  if (rnd.chance(0.25)) {
    const machine = rnd.pick(machines)
    actual.push({ machine: machine.id, article: rnd.pick(articles).number, actualStart: wallClock(day, rnd.int(360, 1200)) })
  }

  const gap = rnd.chance(0.05)
  const outlier = rnd.chance(0.04)
  const realization = outlier ? rnd.between(0.4, 0.6) : rnd.normal(0.88, 0.05)
  return {
    day,
    otPlan,
    utPlanned: rnd.chance(0.1) ? null : utPlanned,
    utActual: gap ? null : Math.max(0, utPlanned * realization),
    pvPlan,
    otActual: gap ? null : Math.max(0, pvPlan * rnd.normal(1, 0.04) + (outlier ? 6 : 0)),
    planned,
    actual,
  }
}

function wallClock(day: string, minutes: number): string {
  const date = parseIsoDay(day)
  date.setUTCMinutes(minutes)
  return `${formatIsoDay(date)}T${date.toISOString().slice(11, 16)}`
}
