'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { submitLead, type LeadFormState } from '@/app/[locale]/lead-actions'
import { buttonPrimaryLg, inputMd } from '@/components/ui/buttons'

/**
 * Das Kontaktformular der Verkaufsseite.
 *
 * Client-Komponente, weil die Antwort an derselben Stelle erscheinen soll, an
 * der jemand gerade getippt hat — ein Redirect auf eine Dankeseite wirft den
 * Leser aus dem Abschnitt, den er gerade liest, und die
 * Zurueck-Taste bringt ihn in ein abgeschicktes Formular zurueck.
 *
 * Vier Felder, von denen eines Pflicht ist. Jede weitere Pflichtangabe kostet
 * Abschluesse; was fehlt, fragt der Vertrieb im ersten Gespraech.
 */
export default function LeadForm({ source = 'website' }: { source?: 'website' | 'pricing' }) {
  const t = useTranslations('Lead')
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(submitLead, null)

  if (state?.ok) {
    return (
      <div className="rounded-surface border border-brand-200 bg-brand-50 p-6">
        <p className="font-medium text-zinc-950">{t('thanksTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">{t('thanksBody')}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-surface border border-zinc-200 bg-white p-6">
      <input type="hidden" name="source" value={source} />

      {/* Koederfeld gegen Formularausfueller. Unsichtbar und aus dem
          Tabulatorlauf und dem Screenreader genommen — ein Mensch kann es
          nicht ausfuellen, ein Programm, das stur alle Felder fuellt, schon.
          `hidden` statt display:none per Klasse, damit es auch ohne
          geladenes CSS unsichtbar bleibt. */}
      <div hidden aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">
            {t('emailLabel')} <span aria-hidden className="text-red-600">*</span>
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className={inputMd}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('nameLabel')}</span>
          <input name="fullName" type="text" autoComplete="name" className={inputMd} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('companyLabel')}</span>
          <input name="company" type="text" autoComplete="organization" className={inputMd} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">{t('roleLabel')}</span>
          <input
            name="jobTitle"
            type="text"
            autoComplete="organization-title"
            placeholder={t('rolePlaceholder')}
            className={inputMd}
          />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-700">{t('messageLabel')}</span>
        <textarea
          name="message"
          rows={3}
          placeholder={t('messagePlaceholder')}
          className="rounded-control border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      {/* Die Einwilligung steht ungekuerzt da und ist nicht vorangekreuzt. Der
          Wortlaut wird mit dem Eintrag gespeichert (consent_text) — sonst
          waere nach der naechsten Textaenderung nicht mehr belegbar, wem
          zugestimmt wurde. */}
      <label className="mt-4 flex items-start gap-3">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 shrink-0 rounded-control border-zinc-300"
        />
        <span className="text-xs leading-relaxed text-zinc-600">{t('consent')}</span>
      </label>

      {state?.ok === false && (
        <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonPrimaryLg} mt-5`}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
