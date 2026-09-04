'use server'

import { cookies, headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { ATTRIBUTION_COOKIE, parseAttribution } from '@/lib/crm/attribution'
import { captureLead, recordLeadEvent } from '@/lib/crm/leads'

export type LeadFormState = { ok: true } | { ok: false; error: string } | null

/**
 * Nimmt das Kontaktformular der Verkaufsseite entgegen.
 *
 * Server Action statt Route Handler mit `anon`-Schluessel: Der Eintrag
 * entsteht mit Service-Role (siehe lib/supabase/admin.ts), nicht mit einem
 * Schluessel, der im Browser steht. Eine Policy `TO anon WITH CHECK (true)`
 * auf `vsm_leads` waere die Alternative gewesen — ein offenes Schreibrecht auf
 * personenbezogene Daten fuer jeden, der den Quelltext liest.
 */
export async function submitLead(
  _prev: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const t = await getTranslations('Lead')

  // Koederfeld. Es ist per CSS und `aria-hidden` unsichtbar und hat einen
  // Namen, den ein Formularausfueller fuer echt haelt; ein Mensch fuellt es
  // nie aus. Die Antwort auf einen Treffer ist ein freundliches "danke" ohne
  // Eintrag: Wer eine Fehlermeldung bekommt, weiss, dass er erkannt wurde,
  // und probiert es anders.
  if ((formData.get('website') as string | null)?.trim()) {
    return { ok: true }
  }

  const email = (formData.get('email') as string | null)?.trim() ?? ''
  if (!email) return { ok: false, error: t('errorEmailRequired') }

  // Die Einwilligung ist keine Formalie: Ohne sie darf der Eintrag nicht
  // entstehen, nicht einmal ohne Werbung.
  if (!formData.get('consent')) {
    return { ok: false, error: t('errorConsentRequired') }
  }

  const store = await cookies()
  const attribution = parseAttribution(store.get(ATTRIBUTION_COOKIE)?.value)
  const locale = await getLocale()

  const result = await captureLead({
    email,
    fullName: formData.get('fullName') as string | null,
    company: formData.get('company') as string | null,
    jobTitle: formData.get('jobTitle') as string | null,
    phone: formData.get('phone') as string | null,
    message: formData.get('message') as string | null,
    locale,
    source: sourceOf(formData.get('source')),
    attribution,
    // Der Wortlaut, dem zugestimmt wurde — nicht nur, dass zugestimmt wurde.
    // Ein spaeter geaenderter Formulartext macht sonst jede alte Einwilligung
    // unbelegbar.
    consentText: t('consent'),
  })

  if (!result.ok) {
    if (result.error === 'invalid_email') return { ok: false, error: t('errorEmailInvalid') }
    // 'not_configured' und 'failed' sehen fuer den Absender gleich aus. Dass
    // der Betreiber seinen Service-Role-Schluessel vergessen hat, ist nichts,
    // was auf der Verkaufsseite stehen sollte.
    return { ok: false, error: t('errorFailed') }
  }

  await recordLeadEvent({
    leadId: result.leadId,
    kind: 'form',
    body: (formData.get('message') as string | null)?.trim() || null,
    payload: {
      source: sourceOf(formData.get('source')),
      locale,
      // Die Seite, auf der das Formular stand — nicht die Landeseite des
      // ersten Besuchs, die in `landing_path` steht.
      path: (await headers()).get('referer') ?? null,
    },
  })

  return { ok: true }
}

/** Nur bekannte Werte. `source` steht als verstecktes Feld im Formular und
 *  kaeme sonst ungeprueft aus dem Browser in die Datenbank. */
function sourceOf(value: FormDataEntryValue | null): string {
  const allowed = ['website', 'pricing', 'demo']
  const raw = typeof value === 'string' ? value : ''
  return allowed.includes(raw) ? raw : 'website'
}
