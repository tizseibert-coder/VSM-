'use client'

import { useMemo, useState } from 'react'
import { DEMO_BUFFERS, DEMO_PROCESSES, DEMO_PROJECT } from '@/lib/vsm/demoProject'
import type { VsmState } from '@/lib/vsm/vsmStore'
import { VsmMutationProvider } from './VsmMutationContext'
import VSMCanvasLoader from './VSMCanvasLoader'

/**
 * Haelt den Zustand der Demo im Browser.
 *
 * Der Editor arbeitet in beiden Betriebsarten auf einem Zustand, den er selbst
 * haelt und aus seinen Props nachfuehrt (siehe VSMCanvas). Im Normalbetrieb
 * kommen diese Props vom Server; hier kommen sie aus diesem useState, und der
 * Zustand ueberlebt damit auch ein Aus- und Wiedereinklappen des Canvas.
 *
 * Nichts wird gespeichert. Ein Neuladen der Seite setzt die Demo zurueck, und
 * das ist beabsichtigt: Ohne Konto gibt es keinen Ort, an dem die Aenderungen
 * jemandem gehoeren wuerden. `isDemo` sagt dem Editor genau das — er laesst
 * dann die Server-Actions weg, die es hier nicht gibt.
 */
export default function DemoCanvas() {
  const [state, setState] = useState<VsmState>({
    project: DEMO_PROJECT,
    processes: DEMO_PROCESSES,
    buffers: DEMO_BUFFERS,
  })

  // setState ist stabil, der Wert aendert sich also nie — ohne useMemo waere
  // es bei jedem Zeichnen ein neues Objekt und jeder Verbraucher des Context
  // wuerde umsonst neu zeichnen.
  const mutation = useMemo(() => ({ mutate: setState, isDemo: true }), [])

  return (
    <VsmMutationProvider value={mutation}>
      <VSMCanvasLoader
        project={state.project}
        scenarioId={null}
        scenarioName={null}
        initialProcesses={state.processes}
        initialBuffers={state.buffers}
      />
    </VsmMutationProvider>
  )
}
