import type { Tables } from '@/types/database'
import { calcCamaLine, resolveMonthlyValues, type CamaLineResult, type ShiftModel } from '@/lib/vsm/capacityAnalysis'

type LineCapacity = Tables<'line_capacity'>

/**
 * Wandelt die Kapazitätsdaten einer Linie in ihr CAMA-Ergebnis um — der
 * Adapter zwischen der Datenbankform (line_capacity, jsonb, ungeprüft) und
 * der reinen Rechnung in capacityAnalysis.ts.
 *
 * Alle fünf Eingangsgrößen (Taktrate, Bedienerzahl, NEE, Schichtmodell,
 * Monatsnachfrage) kommen von der Linie selbst, nicht von einer
 * VSM-Prozessbox — seit der Linien-Umstellung (docs/plan-cama-line-module.md)
 * ist eine Linie mit CAMA-Daten auch ohne verknüpftes VSM gültig ("Linie B
 * hat nur Kapazitätsdaten, kein VSM"). Ist eine Prozessbox verknüpft
 * (processes.line_id), zeigt sie dieselbe Ampel, weil beide dieselbe
 * `line_capacity`-Zeile lesen — keine zweite Berechnung, kein Abgleich nötig.
 *
 * Bewusst *nicht* in capacityAnalysis.ts selbst: die dortigen Funktionen
 * kennen `Tables<'line_capacity'>` nicht (siehe calculations.ts/capacity.ts,
 * die genauso nur schmale eigene Input-Typen nehmen, keine Datenbankzeilen)
 * — Entkopplung von reiner Rechnung und Datenbankschema. Dieser Adapter
 * gehört stattdessen hierher, neben camaColors.ts, weil beide Aufrufer
 * (ProcessBox auf dem Canvas, die Kapazitätsseite) UI-Code sind.
 *
 * `null`, wenn keine Linie verknüpft ist oder Schichtmodell/Taktrate nicht
 * gesetzt sind — "nicht erfasst", keine erfundene Ampel.
 */
export function computeCamaLine(
  lineCapacity: LineCapacity | null,
  workdaysByMonth: number[]
): CamaLineResult | null {
  if (!lineCapacity) return null
  return computeFrom(lineCapacity, lineCapacity.monthly_demand, workdaysByMonth)
}

/**
 * Wie computeCamaLine, aber mit der Stress-/Upside-Nachfrage
 * (line_capacity.monthly_demand_stretch) statt der Basisprognose — das
 * "Load Ratio with Demands Forecast +20%"-Konzept aus dem Schneider-CAMA-
 * Playbook (docs/plan-cama-line-module.md, Abschnitt "Stresslinie"). `null`,
 * wenn kein Stresswert hinterlegt ist — kein fester Faktor zur Basisnachfrage,
 * jede Firma waehlt ihren eigenen Aufschlag beim Eintragen.
 */
export function computeCamaStretchLine(
  lineCapacity: LineCapacity | null,
  workdaysByMonth: number[]
): CamaLineResult | null {
  if (!lineCapacity || lineCapacity.monthly_demand_stretch === null) return null
  return computeFrom(lineCapacity, lineCapacity.monthly_demand_stretch, workdaysByMonth)
}

function computeFrom(
  lineCapacity: LineCapacity,
  rawDemand: unknown,
  workdaysByMonth: number[]
): CamaLineResult | null {
  if (lineCapacity.shift_model !== 1 && lineCapacity.shift_model !== 2 && lineCapacity.shift_model !== 3) return null
  if (lineCapacity.cycle_time_minutes === null) return null

  const monthlyDemand = resolveMonthlyValues(rawDemand, 0)
  return calcCamaLine(
    {
      cycleTimeMinutes: lineCapacity.cycle_time_minutes,
      operatorCount: lineCapacity.operator_count,
      neeFraction: lineCapacity.oee / 100,
      shiftModel: lineCapacity.shift_model as ShiftModel,
    },
    monthlyDemand,
    workdaysByMonth
  )
}
