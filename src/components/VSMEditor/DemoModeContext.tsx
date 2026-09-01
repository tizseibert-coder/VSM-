'use client'

import { createContext, useContext } from 'react'
import type { DemoState } from '@/lib/vsm/demoStore'

/**
 * Setzt den Editor in den Demo-Modus.
 *
 * Ist eine Funktion gesetzt, geht jede Aenderung an sie statt an eine
 * Server-Action. Der Editor haelt sonst keinen eigenen Zustand ("const
 * processes = initialProcesses"); den Weg zurueck uebernimmt hier die
 * Komponente, die den Zustand haelt und ihn als initialProcesses wieder
 * hineingibt.
 *
 * Bewusst ein Context und keine Prop: Die drei Bearbeitungspanels sind
 * eigenstaendige Komponenten mit eigenem startTransition, und die Funktion
 * durch alle Ebenen zu reichen haette an jeder Stelle eine weitere Prop
 * bedeutet, die nur im Demofall etwas tut. Der Konva-Baum ist davon nicht
 * betroffen: Die Panels sind gewoehnliches DOM, dort greift Context normal.
 */
export type DemoMutate = (update: (state: DemoState) => DemoState) => void

const DemoModeContext = createContext<DemoMutate | null>(null)

export const DemoModeProvider = DemoModeContext.Provider

/** Gibt die Aenderungsfunktion zurueck, oder null im Normalbetrieb. */
export function useDemoMutate(): DemoMutate | null {
  return useContext(DemoModeContext)
}
