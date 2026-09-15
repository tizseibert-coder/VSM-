import type { Tables } from '@/types/database'
import { calcCamaLine, resolveMonthlyValues, type CamaLineResult, type ShiftModel } from '@/lib/vsm/capacityAnalysis'

type Process = Tables<'processes'>

/**
 * Wandelt eine rohe Prozesszeile in ihr CAMA-Ergebnis um — der Adapter
 * zwischen der Datenbankform (processes.shift_model/monthly_demand, jsonb,
 * ungeprüft) und der reinen Rechnung in capacityAnalysis.ts.
 *
 * Bewusst *nicht* in capacityAnalysis.ts selbst: die dortigen Funktionen
 * kennen `Tables<'processes'>` nicht (siehe calculations.ts/capacity.ts,
 * die genauso nur schmale eigene Input-Typen nehmen, keine Datenbankzeilen)
 * — Entkopplung von reiner Rechnung und Datenbankschema. Dieser Adapter
 * gehört stattdessen hierher, neben camaColors.ts, weil beide Aufrufer
 * (ProcessBox auf dem Canvas, die Kapazitätsseite) UI-Code sind.
 *
 * `null`, wenn kein Schichtmodell gesetzt ist — "nicht erfasst", keine
 * erfundene Ampel.
 */
export function computeCamaLine(process: Process, workdaysByMonth: number[]): CamaLineResult | null {
  if (process.shift_model !== 1 && process.shift_model !== 2 && process.shift_model !== 3) return null

  const monthlyDemand = resolveMonthlyValues(process.monthly_demand, 0)
  return calcCamaLine(
    {
      cycleTimeMinutes: process.cycle_time,
      operatorCount: process.operator_count,
      neeFraction: process.oee / 100,
      shiftModel: process.shift_model as ShiftModel,
    },
    monthlyDemand,
    workdaysByMonth
  )
}
