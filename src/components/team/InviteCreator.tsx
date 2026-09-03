'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createInvite, type CreateInviteResult } from '@/app/[locale]/team/actions'
import { buttonPrimary, inputMd } from '@/components/ui/buttons'

// Client-Komponente, weil der fertige Link *einmalig* aus der Action
// zurueckkommt und angezeigt werden muss. Ueber einen Redirect-Parameter
// zurueckzureichen waere einfacher gewesen, wuerde den Token aber in die
// Browser-Historie und in die Server-Logs schreiben — und er ist der
// eigentliche Schluessel.
export default function InviteCreator() {
  const t = useTranslations('Team')
  const [result, formAction, pending] = useActionState<CreateInviteResult, FormData>(
    createInvite,
    null
  )
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('roleLabel')}</span>
          <select
            name="role"
            defaultValue="editor"
            className={inputMd}
          >
            <option value="editor">{t('roleEditorOption')}</option>
            <option value="viewer">{t('roleViewerOption')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className={buttonPrimary}
        >
          {pending ? t('creating') : t('createLink')}
        </button>
      </form>

      {result?.ok === false && (
        <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </p>
      )}

      {result?.ok === true && (
        <div className="mt-4 rounded-control border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-600">
            {t('linkCreatedPrefix')} <strong>{t('linkValidity')}</strong>{' '}
            {t('linkCreatedMiddle')} <strong>{t('linkOnce')}</strong>
            {t('linkCreatedSuffix')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* readOnly statt disabled: der Text muss markierbar bleiben, falls
                die Zwischenablage im Browser gesperrt ist. */}
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-control border border-zinc-300 bg-white px-3 py-2 font-mono text-xs"
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
              className="shrink-0 rounded-control border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
