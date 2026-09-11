'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { buildDemoState } from '@/lib/vsm/demoProject'
import {
  readInitialDemoTransfer,
  subscribeNever,
  writeDemoTransfer,
} from '@/lib/vsm/demoStorage'
import { fromTransfer, parseSerializedTransfer } from '@/lib/vsm/demoTransfer'
import type { VsmState } from '@/lib/vsm/vsmStore'
import { VsmMutationProvider } from './VsmMutationContext'
import VSMCanvasLoader from './VSMCanvasLoader'
import DemoOutcome from './DemoOutcome'

/**
 * Haelt den Zustand der Demo im Browser.
 *
 * Der Editor arbeitet in beiden Betriebsarten auf einem Zustand, den er selbst
 * haelt und aus seinen Props nachfuehrt (siehe VSMCanvas). Im Normalbetrieb
 * kommen diese Props vom Server; hier kommen sie aus diesem useState, und der
 * Zustand ueberlebt damit auch ein Aus- und Wiedereinklappen des Canvas.
 * `isDemo` sagt dem Editor, dass er die Server-Actions weglassen soll, die es
 * hier nicht gibt.
 *
 * [Bedienbarkeitspruefung 2026-09-03, B17] Die Beschriftungen des Datensatzes
 * kommen aus `Demo.data`; die Zahlen stehen weiter fest in demoProject.ts.
 * Der Anfangszustand wird nur beim ersten Zeichnen gebildet (useState mit
 * Funktion): Ein Sprachwechsel laedt die Seite ohnehin neu, und ohne diese
 * Form wuerde jede Eingabe die eigene Aenderung wieder ueberschreiben.
 *
 * [Marketing-Audit 2026-09-07, A1] Derselbe Anfangszustand bleibt zusaetzlich
 * unveraendert liegen, damit der Abschluss darunter sagen kann, was sich
 * seitdem gerechnet hat. Er wird nie neu gebildet — er ist die Bezugsgroesse,
 * und eine Bezugsgroesse, die mitwandert, misst nichts.
 *
 * [Marketing-Audit 2026-09-07, A2] Hier stand bis zum 07.09.: "Nichts wird
 * gespeichert. Ein Neuladen der Seite setzt die Demo zurueck, und das ist
 * beabsichtigt: Ohne Konto gibt es keinen Ort, an dem die Aenderungen jemandem
 * gehoeren wuerden."
 *
 * Der Satz stimmte nur, wenn „speichern" *auf dem Server* meint. Im Browser
 * gehoeren die Daten weiterhin niemandem ausser dem Nutzer, verlassen das
 * Geraet nicht und brauchen keine Einwilligung — es ist derselbe Rechtsstand
 * wie vorher. Verkaeuferisch war der alte Zustand teuer: Wer zehn Minuten an
 * einem Wertstrom gearbeitet hat, hat investiert, und die Botschaft am Ende
 * lautete faktisch „alles, was Sie gebaut haben, ist gleich weg — moechten Sie
 * ein Konto anlegen?". Die Reihenfolge war falsch herum.
 *
 * Der Hinweisbalken ist deshalb hierher gewandert (vorher demo/page.tsx): Er
 * muss auf den Zustand reagieren. Einer, der weiter „nichts wird gespeichert"
 * behauptet, waere ab dem ersten Klick eine Falschangabe.
 *
 * Und weil der Balken sagt, ein Neuladen setze die Demo nicht mehr zurueck,
 * muss das auch stimmen: Ein gespeicherter Stand wird beim Oeffnen wieder
 * eingesetzt. Ohne das ueberlebte zwar der Eintrag, die Zeichenflaeche zeigte
 * aber wieder den Ausgangsdatensatz — und das Dashboard boete spaeter einen
 * Wertstrom an, den der Nutzer auf dem Bildschirm nie wiedergesehen hat.
 *
 * Der *Ausgangs*zustand bleibt dabei der unberuehrte Datensatz: Der Abschluss
 * darunter vergleicht gegen ihn, damit auch nach einem Neuladen dasteht, was
 * sich gegenueber der Originaldemo gerechnet hat.
 */
export default function DemoCanvas() {
  const t = useTranslations('Demo.data')
  const tDemo = useTranslations('Demo')

  const [initial] = useState<VsmState>(() =>
    buildDemoState({
      projectName: t('projectName'),
      description: t('description'),
      company: t('company'),
      productName: t('productName'),
      customerName: t('customerName'),
      supplierName: t('supplierName'),
      erpLabel: t('erpLabel'),
      lineLabel: t('lineLabel'),
      processNames: [t('process1'), t('process2'), t('process3'), t('process4'), t('process5')],
    })
  )
  // Der Stand, mit dem dieser Seitenaufruf begonnen hat. Auf dem Server `null`
  // — dort gibt es keinen Browserspeicher —, im Browser der gespeicherte
  // Eintrag. `useSyncExternalStore` ist der dafuer vorgesehene Weg; ein Effekt,
  // der beim Einhaengen `setState` ruft, waere eine Kaskade von Neuzeichnungen.
  const storedRaw = useSyncExternalStore(subscribeNever, readInitialDemoTransfer, () => null)

  // Abgeleitet statt gespeichert: Der wiederhergestellte Zustand ist eine
  // Funktion des Anfangsstands, kein eigener Zustand, der nachgefuehrt werden
  // muesste.
  const restored = useMemo(() => {
    const parsed = parseSerializedTransfer(storedRaw)
    return parsed ? fromTransfer(parsed, initial) : null
  }, [storedRaw, initial])

  // Was der Nutzer *in dieser Sitzung* geaendert hat. Solange nichts, gilt der
  // wiederhergestellte Stand; gibt es auch den nicht, der Ausgangsdatensatz.
  const [edited, setEdited] = useState<VsmState | null>(null)
  const state = edited ?? restored ?? initial

  // Fuer die Aktualisierungsfunktion unten: Sie laeuft in Ereignisbehandlern
  // und braucht den geltenden Zustand, ohne dass `mutate` sich bei jeder
  // Wiederherstellung aendert (das zeichnete alle Context-Verbraucher neu).
  const baseRef = useRef(state)
  useEffect(() => {
    baseRef.current = state
  }, [state])

  // Referenzvergleich genuegt: Die Uebergaenge in vsmStore.ts sind rein und
  // geben nur bei einer echten Aenderung ein neues Objekt zurueck. Beim ersten
  // Zeichnen ohne gespeicherten Stand ist `state === initial`, es wird also
  // nichts geschrieben — wer die Demo nur ansieht, hinterlaesst keinen Eintrag.
  const touched = state !== initial

  useEffect(() => {
    if (touched) writeDemoTransfer(state)
  }, [touched, state])

  // `mutate` verhaelt sich wie ein setState und nimmt auch die Form
  // `mutate(s => ...)`, weil der Editor sie so benutzt.
  const mutate = useCallback((next: VsmState | ((prev: VsmState) => VsmState)) => {
    setEdited(typeof next === 'function' ? next(baseRef.current) : next)
  }, [])

  const mutation = useMemo(() => ({ mutate, isDemo: true }), [mutate])

  return (
    <VsmMutationProvider value={mutation}>
      {/* Der Hinweis steht oben und nicht als Fusszeile: Wer gleich Zahlen
          aendert, soll vorher wissen, was damit passiert. */}
      <div className="border-b border-zinc-200 bg-brand-50">
        <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-zinc-700">
          <span className="font-medium text-zinc-950">
            {touched ? tDemo('noticeKeptStrong') : tDemo('noticeStrong')}
          </span>{' '}
          {touched ? tDemo('noticeKeptBody') : tDemo('noticeBody')}
        </p>
      </div>

      <VSMCanvasLoader
        project={state.project}
        scenarioId={null}
        scenarioName={null}
        initialProcesses={state.processes}
        initialBuffers={state.buffers}
      />
      <DemoOutcome initial={initial} current={state} />
    </VsmMutationProvider>
  )
}
