'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'

const BASE_CLASS = 'rounded-control px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-70'
const IDLE_CLASS = 'bg-brand-600 hover:bg-brand-700'
const SAVED_CLASS = 'bg-emerald-600 hover:bg-emerald-700'

/** Wie lange der Knopf gruen bleibt. Lang genug zum Lesen, kurz genug, dass
 *  ein zweites Speichern derselben Frage wieder als Speichern dasteht. */
const SAVED_MS = 3000

/**
 * Speichern-Knopf der Wizard-Fragen, der die eigene Rueckmeldung traegt.
 *
 * Vorher lag die Bestaetigung ausschliesslich in der Zeile "✓ Gespeichert."
 * oben auf der Seite (ueber `?saved=1`). Auf den Fragen 3, 4 und 8 steht aber
 * pro Verbindung bzw. pro Prozess ein eigenes Formular — eine einzelne Zeile
 * am Seitenanfang beantwortet dort nicht, *welche* Zeile gerade gespeichert
 * wurde, und der Blick ist zum Zeitpunkt des Klicks ohnehin auf dem Knopf.
 *
 * `useFormStatus` gilt genau fuer das umschliessende Formular, nicht fuer die
 * Seite: Damit faerbt sich der Knopf, den jemand gedrueckt hat, und kein
 * anderer. Die Wahrheit dahinter bleibt der Server — `pending` faellt erst
 * zurueck, wenn die Server-Action samt Weiterleitung durch ist, "Gespeichert"
 * behauptet also nichts, was nicht geschrieben waere.
 *
 * Ohne JavaScript bleibt der Knopf beim gewohnten Text; dann traegt die
 * Zeile oben die Rueckmeldung weiter. Deshalb steht sie weiterhin dort.
 */
export function WizardSaveButton({
  label,
  className = '',
}: {
  /** Abweichende Beschriftung im Ruhezustand (Frage 5: "Als Schrittmacher setzen"). */
  label?: string
  className?: string
}) {
  const t = useTranslations('Wizard')
  // Boolean() ist hier kein Zierrat: Nachdem die Action durch ist, rendert
  // React diesen Knopf einmal ausserhalb des Formularkontexts, und
  // useFormStatus() liefert dann `pending: undefined`. Ungeglaettet wechselt
  // die Abhaengigkeit unten von false auf undefined, der Effekt laeuft erneut,
  // sein Aufraeumen loescht den Ruecksetz-Zeitgeber — und der Knopf bliebe
  // fuer immer gruen. Gemessen mit einer Probe-Seite: false -> true ->
  // false -> undefined.
  const pending = Boolean(useFormStatus().pending)
  const [saved, setSaved] = useState(false)
  const wasPending = useRef(false)

  useEffect(() => {
    if (pending) {
      wasPending.current = true
      return
    }
    // Nur die Flanke von "laeuft" nach "fertig" zaehlt — beim ersten Rendern
    // hat noch niemand gespeichert, und der Knopf steht unveraendert da.
    if (!wasPending.current) return
    wasPending.current = false
    setSaved(true)
    const timer = setTimeout(() => setSaved(false), SAVED_MS)
    return () => clearTimeout(timer)
  }, [pending])

  // Ein laufendes Speichern hat Vorrang vor dem gruenen Nachklang des
  // vorherigen: Wer waehrend der drei Sekunden ein zweites Mal speichert,
  // soll nicht "Gespeichert" lesen, waehrend noch geschrieben wird.
  const showSaved = saved && !pending

  return (
    <button
      type="submit"
      disabled={pending}
      aria-live="polite"
      className={`${BASE_CLASS} ${showSaved ? SAVED_CLASS : IDLE_CLASS} ${className}`}
    >
      {pending ? t('saving') : showSaved ? t('savedButton') : (label ?? t('save'))}
    </button>
  )
}
