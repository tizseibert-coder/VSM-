'use client'

import { useEffect } from 'react'
import { clearDemoTransfer } from '@/lib/vsm/demoStorage'

/**
 * Raeumt den Zwischenstand der Demo weg, nachdem er uebernommen wurde.
 *
 * [Marketing-Audit 2026-09-07, A2] Eine Server Action kann keinen
 * `localStorage` anfassen — sie laeuft nicht im Browser. Ohne diese Zeile
 * bliebe der Eintrag nach der Uebernahme liegen, und das Dashboard boete
 * denselben Wertstrom beim naechsten Besuch ein zweites Mal an. Wer zustimmt,
 * haette ihn dann doppelt.
 *
 * Deshalb hier und nicht schon im Banner beim Absenden: Scheitert die
 * Uebernahme (Tarifgrenze erreicht, Datenbank nicht erreichbar), ist der
 * Zwischenstand noch da. Geloescht wird erst, wenn der Nutzer im fertigen
 * Projekt steht — also an der einzigen Stelle, an der der Erfolg feststeht.
 *
 * Zeichnet nichts. Der Editor daneben merkt davon nichts.
 */
export default function ClearDemoTransfer() {
  useEffect(() => {
    clearDemoTransfer()
  }, [])

  return null
}
