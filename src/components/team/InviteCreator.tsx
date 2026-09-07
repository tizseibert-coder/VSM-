'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createInvite, type CreateInviteResult } from '@/app/[locale]/team/actions'
import { INVITE_DAY_CHOICES, INVITE_DAYS_DEFAULT, MAX_WELCOME_LENGTH } from '@/lib/org/invites'
import { buttonPrimary, inputMd } from '@/components/ui/buttons'

// Client-Komponente, weil der fertige Link *einmalig* aus der Action
// zurueckkommt und angezeigt werden muss. Ueber einen Redirect-Parameter
// zurueckzureichen waere einfacher gewesen, wuerde den Token aber in die
// Browser-Historie und in die Server-Logs schreiben — und er ist der
// eigentliche Schluessel.
export default function InviteCreator({ hasBranding }: { hasBranding: boolean }) {
  const t = useTranslations('Team')
  const [result, formAction, pending] = useActionState<CreateInviteResult, FormData>(
    createInvite,
    null
  )
  const [copied, setCopied] = useState(false)
  // Zugeklappt, weil der haeufige Fall unveraendert bleibt: Rolle waehlen,
  // Link erzeugen, fertig. Die Angaben darunter braucht, wer jemanden von
  // aussen anspricht — und der sucht sie dann auch.
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">{t('roleLabel')}</span>
            <select name="role" defaultValue="editor" className={inputMd}>
              <option value="editor">{t('roleEditorOption')}</option>
              <option value="viewer">{t('roleViewerOption')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">{t('validityLabel')}</span>
            <select name="valid_days" defaultValue={String(INVITE_DAYS_DEFAULT)} className={inputMd}>
              {INVITE_DAY_CHOICES.map((days) => (
                <option key={days} value={days}>
                  {t('validityDays', { days })}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={pending} className={buttonPrimary}>
            {pending ? t('creating') : t('createLink')}
          </button>
        </div>

        {/* Kein <details>: Die Felder muessen auch zugeklappt im Formular
            stehen bleiben, sonst gingen halb eingetippte Angaben verloren,
            sobald jemand den Bereich wieder schliesst. */}
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          {expanded ? t('customiseHide') : t('customiseShow')}
        </button>

        <div hidden={!expanded} className="space-y-4 rounded-surface border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-600">{t('customiseBody')}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-700">{t('inviteLabel')}</span>
              <input
                name="label"
                maxLength={120}
                placeholder={t('inviteLabelPlaceholder')}
                className={inputMd}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-700">{t('inviteeName')}</span>
              <input name="invitee_name" maxLength={120} className={inputMd} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-700">{t('inviteeCompany')}</span>
              <input name="invitee_company" maxLength={160} className={inputMd} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">{t('welcomeMessage')}</span>
            <textarea
              name="welcome_message"
              rows={3}
              maxLength={MAX_WELCOME_LENGTH}
              placeholder={t('welcomeMessagePlaceholder')}
              className="rounded-control border border-zinc-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-zinc-500">{t('welcomeMessageHint')}</span>
          </label>

          <label className="flex items-start gap-2">
            {/* Der versteckte Zwilling davor: Ein nicht angehaktes Kaestchen
                schickt gar nichts, und „gar nichts" waere in der Action nicht
                von „Feld gibt es nicht" zu unterscheiden. */}
            <input type="hidden" name="show_branding" value="0" />
            <input
              type="checkbox"
              name="show_branding"
              value="1"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded-control border-zinc-300"
            />
            <span className="text-xs text-zinc-700">
              {t('showBranding')}
              <span className="mt-0.5 block text-zinc-500">
                {hasBranding ? t('showBrandingHint') : t('showBrandingEmpty')}
              </span>
            </span>
          </label>
        </div>
      </form>

      {result?.ok === false && (
        <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </p>
      )}

      {result?.ok === true && (
        <div className="mt-4 rounded-control border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-600">
            {t('linkCreatedPrefix')}{' '}
            <strong>{t('validityDays', { days: result.days })}</strong>{' '}
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
