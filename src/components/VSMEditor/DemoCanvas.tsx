'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { buildDemoState } from '@/lib/vsm/demoProject'
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
 *
 * [Bedienbarkeitspruefung 2026-09-03, B17] Die Beschriftungen des Datensatzes
 * kommen aus `Demo.data`; die Zahlen stehen weiter fest in demoProject.ts.
 * Der Anfangszustand wird nur beim ersten Zeichnen gebildet (useState mit
 * Funktion): Ein Sprachwechsel laedt die Seite ohnehin neu, und ohne diese
 * Form wuerde jede Eingabe die eigene Aenderung wieder ueberschreiben.
 */
export default function DemoCanvas() {
  const t = useTranslations('Demo.data')
  const [state, setState] = useState<VsmState>(() =>
    buildDemoState({
      projectName: t('projectName'),
      description: t('description'),
      company: t('company'),
      productName: t('productName'),
      customerName: t('customerName'),
      supplierName: t('supplierName'),
      erpLabel: t('erpLabel'),
      processNames: [t('process1'), t('process2'), t('process3'), t('process4'), t('process5')],
    })
  )

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
