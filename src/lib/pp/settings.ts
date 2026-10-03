// Tagesplanung — die Einstellungen einer Organisation (pp_settings).
//
// Alles, was in einem Werk anders ist als im naechsten, steht hier und nicht
// im Code: Schichten, Codes, Ampel-Schwellen, der DLP-Faktor. Die Vorgaben
// unten sind bewusst *neutral* — ein gaengiges 3-Schicht-Modell und die
// Ampel-Schwellen aus dem Konzept. Werkseigene Konstanten (DLP-Faktor,
// Kmix-Ziel) haben keine Vorgabe: Sie gehoeren in die Zeile der jeweiligen
// Organisation, nie als Default in den Code und nie in Tests
// (docs/plan-tagesplanung-modul.md, „Kernentscheidungen").

export type ShiftKind = 'work' | 'absent'

export interface ShiftDefinition {
  /** Code, wie er im Schichtplan steht (Kleinbuchstabe, z. B. "f"). */
  code: string
  label: string
  kind: ShiftKind
  /** Bezahlte Stunden der Schicht. 0 bei Abwesenheit. */
  hours: number
  /**
   * Beginn in Minuten ab Mitternacht. Nur noetig, wenn die Schicht ueber
   * Mitternacht laeuft — dann teilt pvHoursForDay die Stunden auf beide
   * Kalendertage auf. Ohne Beginn (z. B. Teilzeit) zaehlen alle Stunden auf
   * den Tag, an dem der Code steht.
   */
  startMinutes?: number
}

/**
 * Eine Rolle im Schichtplan und wie stark ihre Stunden in die geplante OT
 * eingehen. Im Vorgaengertool: Einrichter voll, Lernende und Unterstuetzer
 * anteilig, alle anderen gar nicht — wer nicht ruesten oder bedienen kann,
 * erzeugt keine Auftragszeit. Die Gewichte sind Werkswerte und stehen in den
 * Einstellungen der Organisation; die Vorgabe kennt nur eine Rolle mit 1.
 */
export interface RoleDefinition {
  code: string
  label: string
  weight: number
}

export type SetupType = 'N' | 'A' | 'M' | 'AM'

/** Zwei Stufen, damit eine Ampel nicht an einer einzigen Zahl haengt. */
export interface Band {
  green: number
  yellow: number
}

export interface PpSettings {
  /**
   * Personalstunden, die eine Maschinenstunde traegt: DLP = UT × f − OT.
   * Das Kmix-Ziel ist 1 / f (dort ist DLP genau 0). `null` = noch nicht
   * festgelegt; dann gilt der eigene Ausgangswert (resolveKmixTarget).
   */
  dlpFactor: number | null
  shifts: ShiftDefinition[]
  roles: RoleDefinition[]
  /**
   * Codes, die beim Import auf einen anderen Code abgebildet werden, bevor
   * sie gespeichert werden. Vorgabe: krank und Ferien werden „abwesend" —
   * fuer die Planung zaehlt, *dass* jemand fehlt, der Grund ist eine
   * Gesundheitsangabe und gehoert nicht ins Werkzeug.
   */
  importCodeMap: Record<string, string>
  /**
   * Ruestnormen in Minuten je Ruesttyp: N kein Wechsel, A Werkzeug, M Material
   * oder Artikel, AM beides. Die Vorgaben sind Platzhalter fuer ein Werk ohne
   * eigene Zahlen; jedes Werk ersetzt sie durch seine — spaeter aus den
   * Ist-Ruestzeiten kalibriert.
   */
  setupNorms: Record<SetupType, number>
  thresholds: {
    /** Abweichung vom Soll in Prozent (PV-Stunden, UT). Kleiner ist besser. */
    deviationPct: Band
    /** DLP in Stunden. Groesser ist besser. */
    dlp: Band
    /** Kmix als Anteil des Ziels (1 = Ziel erreicht). Groesser ist besser. */
    kmixShareOfTarget: Band
    /** Umruestungen plangemaess in Prozent. Groesser ist besser. */
    executionRatePct: Band
    /** Ø Startversatz in Minuten. Kleiner ist besser. */
    startOffsetMin: Band
    /** Ungeplante Umruestungen je Woche. Kleiner ist besser. */
    unplannedPerWeek: Band
  }
  /** Die Regeln aus computeActionSuggestions des Vorgaengertools, als Zahlen. */
  actionEngine: {
    /** Wie viele der juengsten Tage mit Daten die Regeln anschauen. */
    windowDataDays: number
    /** Ab so vielen Stunden PV-Ist ueber/unter PV-Plan ist ein Tag auffaellig (D1). */
    otDeviationHours: number
    otDeviationDays: number
    /** Ausfuehrungsrate in Prozent, unter der ein Tag auffaellig ist (D2). */
    executionRateBelowPct: number
    executionRateDays: number
    /** Falsche Schicht: Summe in der Woche *oder* Zahl betroffener Tage (D4). */
    wrongShiftTotal: number
    wrongShiftDays: number
    /** Ø Rueststart spaeter als so viele Minuten (D4). */
    lateStartMin: number
    lateStartDays: number
    /** Ungeplante Umruestungen, Summe ueber das Fenster (D2). */
    unplannedTotal: number
    /** Tage mit negativem DLP (D3). */
    negativeDlpDays: number
    /** Tage mit Kmix unter Ziel (D3). */
    lowKmixDays: number
  }
}

export const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { code: 'f', label: 'Früh', kind: 'work', hours: 8, startMinutes: 6 * 60 },
  { code: 's', label: 'Spät', kind: 'work', hours: 8, startMinutes: 14 * 60 },
  { code: 'n', label: 'Nacht', kind: 'work', hours: 8, startMinutes: 22 * 60 },
  { code: 't', label: 'Teilzeit', kind: 'work', hours: 4 },
  { code: 'a', label: 'Abwesend', kind: 'absent', hours: 0 },
]

export const DEFAULT_ROLES: RoleDefinition[] = [{ code: 'default', label: 'Mitarbeitende', weight: 1 }]

export const DEFAULT_SETTINGS: PpSettings = {
  dlpFactor: null,
  shifts: DEFAULT_SHIFTS,
  roles: DEFAULT_ROLES,
  importCodeMap: { k: 'a', h: 'a' },
  setupNorms: { N: 0, A: 60, M: 30, AM: 90 },
  thresholds: {
    deviationPct: { green: 3, yellow: 8 },
    dlp: { green: 0, yellow: -5 },
    kmixShareOfTarget: { green: 1, yellow: 0.9 },
    executionRatePct: { green: 90, yellow: 70 },
    startOffsetMin: { green: 15, yellow: 30 },
    unplannedPerWeek: { green: 1, yellow: 3 },
  },
  actionEngine: {
    windowDataDays: 7,
    otDeviationHours: 3,
    otDeviationDays: 3,
    executionRateBelowPct: 70,
    executionRateDays: 2,
    wrongShiftTotal: 3,
    wrongShiftDays: 3,
    lateStartMin: 30,
    lateStartDays: 3,
    unplannedTotal: 3,
    negativeDlpDays: 2,
    lowKmixDays: 3,
  },
}

/**
 * Gespeicherte Einstellungen ueber die Vorgaben legen. Die Datenbank haelt
 * jsonb; was dort fehlt (aeltere Zeile, neues Feld), kommt aus der Vorgabe
 * statt als `undefined` in eine Rechnung zu laufen.
 */
export function resolveSettings(stored: Partial<PpSettings> | null | undefined): PpSettings {
  if (!stored) return DEFAULT_SETTINGS
  return {
    dlpFactor: validFactor(stored.dlpFactor) ? stored.dlpFactor : null,
    shifts: stored.shifts && stored.shifts.length > 0 ? stored.shifts : DEFAULT_SETTINGS.shifts,
    roles: stored.roles && stored.roles.length > 0 ? stored.roles : DEFAULT_SETTINGS.roles,
    importCodeMap: stored.importCodeMap ?? DEFAULT_SETTINGS.importCodeMap,
    setupNorms: { ...DEFAULT_SETTINGS.setupNorms, ...stored.setupNorms },
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...stored.thresholds },
    actionEngine: { ...DEFAULT_SETTINGS.actionEngine, ...stored.actionEngine },
  }
}

function validFactor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
