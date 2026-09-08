'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { importDemoProject } from '@/app/[locale]/dashboard/actions'
import {
  clearDemoTransfer,
  readRawDemoTransfer,
  subscribeToDemoTransfer,
} from '@/lib/vsm/demoStorage'
import { parseSerializedTransfer } from '@/lib/vsm/demoTransfer'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'

/**
 * „Ihr Wertstrom aus der Demo liegt bereit."
 *
 * [Marketing-Audit 2026-09-07, A2] Das Gegenstueck zum Abschluss unter der
 * Demo: Dort steht das Angebot, hier wird es eingeloest.
 *
 * Gefragt wird trotzdem, statt still anzulegen. Zwei Gruende: Die kostenlose
 * Stufe hat genau einen Wertstrom, und den ungefragt mit einem Uebungsstand zu
 * belegen waere eine Entscheidung ueber fremdes Kontingent. Und nicht jeder,
 * der sich anmeldet, kommt wegen der Demo — wer ueber eine Einladung kam, hat
 * mit dem Uebungswertstrom im Browser nichts zu tun.
 *
 * `useSyncExternalStore` statt eines Effekts, der beim Einhaengen `setState`
 * ruft: Der `localStorage` ist Aussenwelt, und genau dafuer ist der Haken
 * gebaut. Die Server-Momentaufnahme ist `null` — der Server kennt den Speicher
 * des Browsers nicht, und ein Banner im Server-HTML waere ein
 * Hydrationsfehler. Gelesen wird die **Zeichenkette** und nicht das geparste
 * Objekt: `getSnapshot` muss bei unveraendertem Speicher denselben Wert
 * zurueckgeben, und ein frisch geparstes Objekt waere jedes Mal ein neues.
 */
export default function DemoImportBanner() {
  const t = useTranslations('Dashboard')
  const [dismissed, setDismissed] = useState(false)

  const raw = useSyncExternalStore(
    subscribeToDemoTransfer,
    readRawDemoTransfer,
    () => null
  )

  const transfer = useMemo(() => parseSerializedTransfer(raw), [raw])

  // Abgelaufen oder unlesbar: wegraeumen, sonst laeuft der Eintrag bei jedem
  // Besuch erneut durch dieselbe Pruefung und bleibt doch liegen. Nur ein
  // Seiteneffekt nach aussen, kein `setState` — der Haken oben merkt die
  // Loeschung selbst.
  useEffect(() => {
    if (raw && !transfer) clearDemoTransfer()
  }, [raw, transfer])

  if (!raw || !transfer || dismissed) return null

  return (
    <div className="mt-6 rounded-surface border border-brand-200 bg-brand-50 px-5 py-4">
      <p className="font-medium text-zinc-950">{t('demoImportTitle')}</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-700">
        {t('demoImportBody', {
          name: transfer.projectName,
          count: transfer.processes.length,
        })}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Der Rumpf reist als Feld mit. Der Server glaubt ihm nichts:
            `parseSerializedTransfer` prueft ihn dort noch einmal vollstaendig
            — was durch den Browser ging, ist fremde Eingabe, auch wenn wir es
            selbst geschrieben haben. */}
        <form action={importDemoProject}>
          <input type="hidden" name="transfer" value={raw} />
          <button type="submit" className={buttonPrimary}>
            {t('demoImportAccept')}
          </button>
        </form>

        {/* Verwerfen loescht nur den Zwischenstand im Browser. Absichtlich
            ohne Rueckfrage: Es geht nichts verloren, was der Nutzer nicht in
            zwei Minuten wieder herstellen koennte. */}
        <button
          type="button"
          onClick={() => {
            clearDemoTransfer()
            setDismissed(true)
          }}
          className={buttonSecondary}
        >
          {t('demoImportDiscard')}
        </button>
      </div>
    </div>
  )
}
