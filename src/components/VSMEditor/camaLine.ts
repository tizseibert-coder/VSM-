import type { Tables } from '@/types/database'
import { calcCamaLine, resolveMonthlyValues, type CamaLineResult, type ShiftModel } from '@/lib/vsm/capacityAnalysis'

type Process = Pick<Tables<'processes'>, 'cycle_time' | 'operator_count' | 'oee'>
type LineCapacity = Tables<'line_capacity'>

/**
 * Wandelt eine Prozesszeile plus die Kapazitätsdaten ihrer verknüpften Linie
 * in ihr CAMA-Ergebnis um — der Adapter zwischen der Datenbankform
 * (line_capacity.shift_model/monthly_demand, jsonb, ungeprüft) und der
 * reinen Rechnung in capacityAnalysis.ts.
 *
 * Taktrate/NEE (cycle_time, operator_count, oee) bleiben auf `processes` —
 * das sind VSM-Eigenschaften der Prozessbox. Schichtmodell und
 * Monatsnachfrage kommen seit der Linien-Umstellung (docs/plan-cama-line-module.md)
 * von der verknüpften `production_lines`-Zeile, nicht mehr vom Prozess
 * selbst — deshalb zwei Parameter statt einem.
 *
 * Bewusst *nicht* in capacityAnalysis.ts selbst: die dortigen Funktionen
 * kennen `Tables<'processes'>`/`Tables<'line_capacity'>` nicht (siehe
 * calculations.ts/capacity.ts, die genauso nur schmale eigene Input-Typen
 * nehmen, keine Datenbankzeilen) — Entkopplung von reiner Rechnung und
 * Datenbankschema. Dieser Adapter gehört stattdessen hierher, neben
 * camaColors.ts, weil beide Aufrufer (ProcessBox auf dem Canvas, die
 * Kapazitätsseite) UI-Code sind.
 *
 * `null`, wenn keine Linie verknüpft ist oder deren Schichtmodell nicht
 * gesetzt ist — "nicht erfasst", keine erfundene Ampel.
 */
export function computeCamaLine(
  process: Process,
  lineCapacity: LineCapacity | null,
  workdaysByMonth: number[]
): CamaLineResult | null {
  if (!lineCapacity) return null
  if (lineCapacity.shift_model !== 1 && lineCapacity.shift_model !== 2 && lineCapacity.shift_model !== 3) return null

  const monthlyDemand = resolveMonthlyValues(lineCapacity.monthly_demand, 0)
  return calcCamaLine(
    {
      cycleTimeMinutes: process.cycle_time,
      operatorCount: process.operator_count,
      neeFraction: process.oee / 100,
      shiftModel: lineCapacity.shift_model as ShiftModel,
    },
    monthlyDemand,
    workdaysByMonth
  )
}
