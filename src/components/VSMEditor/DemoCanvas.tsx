'use client'

import { useState } from 'react'
import { DEMO_BUFFERS, DEMO_PROCESSES, DEMO_PROJECT } from '@/lib/vsm/demoProject'
import type { DemoState } from '@/lib/vsm/demoStore'
import { DemoModeProvider } from './DemoModeContext'
import VSMCanvasLoader from './VSMCanvasLoader'

/**
 * Haelt den Zustand der Demo im Browser.
 *
 * Im Normalbetrieb kommt dieser Zustand vom Server: Der Editor bekommt
 * initialProcesses als Prop, schickt jede Aenderung als Server-Action raus
 * und bekommt ueber router.refresh() neue Props. Hier uebernimmt useState
 * dieselbe Rolle — der Editor merkt den Unterschied nicht, er sieht in beiden
 * Faellen nur Props.
 *
 * Nichts wird gespeichert. Ein Neuladen der Seite setzt die Demo zurueck, und
 * das ist beabsichtigt: Ohne Konto gibt es keinen Ort, an dem die Aenderungen
 * jemandem gehoeren wuerden.
 */
export default function DemoCanvas() {
  const [state, setState] = useState<DemoState>({
    project: DEMO_PROJECT,
    processes: DEMO_PROCESSES,
    buffers: DEMO_BUFFERS,
  })

  return (
    <DemoModeProvider value={setState}>
      <VSMCanvasLoader
        project={state.project}
        scenarioId={null}
        scenarioName={null}
        initialProcesses={state.processes}
        initialBuffers={state.buffers}
      />
    </DemoModeProvider>
  )
}
