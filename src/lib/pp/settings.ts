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
  /**
   * Codes, die beim Import auf einen anderen Code abgebildet werden, bevor
   * sie gespeichert werden. Vorgabe: krank und Ferien werden „abwesend" —
   * fuer die Planung zaehlt, *dass* jemand fehlt, der Grund ist eine
   * Gesundheitsangabe und gehoert nicht ins Werkzeug.
   */
  importCodeMap: Record<string, string>
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
  actionEngine: {
    /** Ab wie vielen Stunden OT-Abweichung vom Plan ein Tag auffaellig ist. */
    otDeviationHours: number
    /** Ausfuehrungsrate in Prozent, unter der ein Tag auffaellig ist. */
    executionRateBelowPct: number
    /** Falsche Schichtzuordnungen je Tag, ab denen ein Tag auffaellig ist. */
    wrongShiftPerDay: number
    /** Auffaellige Tage (in Folge bzw. im Fenster), ab denen eine Regel anschlaegt. */
    minDays: number
    /** Fenster in Kalendertagen, ueber das die Regeln schauen. */
    windowDays: number
  }
}

export const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { code: 'f', label: 'Früh', kind: 'work', hours: 8, startMinutes: 6 * 60 },
  { code: 's', label: 'Spät', kind: 'work', hours: 8, startMinutes: 14 * 60 },
  { code: 'n', label: 'Nacht', kind: 'work', hours: 8, startMinutes: 22 * 60 },
  { code: 't', label: 'Teilzeit', kind: 'work', hours: 4 },
  { code: 'a', label: 'Abwesend', kind: 'absent', hours: 0 },
  { code: 'l', label: 'Schule', kind: 'absent', hours: 0 },
  { code: 'p', label: 'Kompensation', kind: 'absent', hours: 0 },
]

export const DEFAULT_SETTINGS: PpSettings = {
  dlpFactor: null,
  shifts: DEFAULT_SHIFTS,
  importCodeMap: { k: 'a', h: 'a' },
  thresholds: {
    deviationPct: { green: 3, yellow: 8 },
    dlp: { green: 0, yellow: -5 },
    kmixShareOfTarget: { green: 1, yellow: 0.9 },
    executionRatePct: { green: 90, yellow: 70 },
    startOffsetMin: { green: 15, yellow: 30 },
    unplannedPerWeek: { green: 1, yellow: 3 },
  },
  actionEngine: {
    otDeviationHours: 3,
    executionRateBelowPct: 70,
    wrongShiftPerDay: 2,
    minDays: 3,
    windowDays: 14,
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
    importCodeMap: stored.importCodeMap ?? DEFAULT_SETTINGS.importCodeMap,
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...stored.thresholds },
    actionEngine: { ...DEFAULT_SETTINGS.actionEngine, ...stored.actionEngine },
  }
}

function validFactor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
