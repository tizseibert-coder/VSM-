'use client'

import { createContext, useContext } from 'react'
import type { VsmState } from '@/lib/vsm/vsmStore'

/**
 * Der Weg, auf dem eine Aenderung in die Zeichenflaeche gelangt.
 *
 * Vorher hiess dieser Context DemoModeContext und war genau das: gesetzt =
 * Demo, nicht gesetzt = Normalbetrieb. Der Editor hielt dabei keinen eigenen
 * Zustand ("const processes = initialProcesses"), also blieb im Normalbetrieb
 * nur der lange Weg ueber Supabase, revalidatePath und router.refresh(),
 * bevor eine Prozessbox sich auch nur einen Platz weiter bewegte. Die Demo
 * fuehlte sich fluessig an, der angemeldete Editor nicht — bei identischer
 * Oberflaeche.
 *
 * Jetzt gehen beide denselben Weg: `mutate` aendert den Zustand, der gerade
 * gezeichnet wird, sofort. `isDemo` sagt nur noch, ob danach *auch* geschrieben
 * wird — in der Demo gibt es keinen Server, und das ist der einzige
 * Unterschied, der bleibt.
 *
 * Bewusst ein Context und keine Prop: Die drei Bearbeitungspanels sind
 * eigenstaendige Komponenten mit eigenem startTransition, und die Funktion
 * durch alle Ebenen zu reichen haette an jeder Stelle eine weitere Prop
 * bedeutet. Der Konva-Baum ist davon nicht betroffen: Die Panels sind
 * gewoehnliches DOM, dort greift Context normal.
 */
export type VsmMutate = (update: (state: VsmState) => VsmState) => void

export interface VsmMutation {
  /** Aendert den Zustand, aus dem gerade gezeichnet wird. Wirkt sofort. */
  mutate: VsmMutate
  /** Demo ohne Konto: Es gibt keine Server-Action, die danach schreiben koennte. */
  isDemo: boolean
}

const VsmMutationContext = createContext<VsmMutation | null>(null)

export const VsmMutationProvider = VsmMutationContext.Provider

/**
 * Gibt Aenderungsfunktion und Betriebsart zurueck.
 *
 * `null` heisst: niemand hat den Context bereitgestellt. Das gilt fuer den
 * VSMCanvas selbst, der ihn erst aufspannt — er liest ihn nur, um eine von
 * aussen (DemoCanvas) vorgegebene Zustandshaltung zu uebernehmen. Alles
 * unterhalb des Canvas bekommt immer einen Wert.
 */
export function useVsmMutation(): VsmMutation | null {
  return useContext(VsmMutationContext)
}

/**
 * Dasselbe fuer die Bearbeitungspanels, die immer im Canvas stecken.
 *
 * Der Fehler faellt beim ersten Zeichnen und benennt die Ursache, statt dass
 * ein `null` sich als "hier wird nichts gespeichert" tarnt — genau der Fehler,
 * der im Demo-Modus lange unbemerkt geblieben waere.
 */
export function useVsmMutationRequired(): VsmMutation {
  const mutation = useContext(VsmMutationContext)
  if (!mutation) {
    throw new Error('useVsmMutationRequired ausserhalb von VsmMutationProvider (VSMCanvas) benutzt')
  }
  return mutation
}
