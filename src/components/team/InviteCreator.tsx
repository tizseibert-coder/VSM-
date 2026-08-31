'use client'

import { useActionState, useState } from 'react'
import { createInvite, type CreateInviteResult } from '@/app/team/actions'

// Client-Komponente, weil der fertige Link *einmalig* aus der Action
// zurueckkommt und angezeigt werden muss. Ueber einen Redirect-Parameter
// zurueckzureichen waere einfacher gewesen, wuerde den Token aber in die
// Browser-Historie und in die Server-Logs schreiben — und er ist der
// eigentliche Schluessel.
export default function InviteCreator() {
  const [result, formAction, pending] = useActionState<CreateInviteResult, FormData>(
    createInvite,
    null
  )
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rolle</span>
          <select
            name="role"
            defaultValue="editor"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="editor">Bearbeiten (editor)</option>
            <option value="viewer">Nur ansehen (viewer)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {pending ? 'Erstelle…' : 'Einladungslink erstellen'}
        </button>
      </form>

      {result?.ok === false && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {result.error}
        </p>
      )}

      {result?.ok === true && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Link erstellt. Er ist <strong>7 Tage</strong> gültig und lässt sich{' '}
            <strong>einmal</strong> einlösen. Kopiere ihn jetzt — er wird nicht noch einmal
            angezeigt.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* readOnly statt disabled: der Text muss markierbar bleiben, falls
                die Zwischenablage im Browser gesperrt ist. */}
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  // Zwischenablage gesperrt (unsicherer Kontext, Richtlinie).
                  // Kein Fehler-Popup: das Feld daneben laesst sich markieren.
                  setCopied(false)
                }
              }}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
