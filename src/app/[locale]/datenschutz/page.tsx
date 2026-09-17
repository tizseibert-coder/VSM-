import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/site'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Datenschutz' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/datenschutz',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

/**
 * Das Gerüst für die Datenschutzerklärung nach Art. 13/14 DSGVO.
 *
 * Der Verantwortliche (Firmenname, Anschrift, ggf. Datenschutzbeauftragter)
 * steht — wie im Impressum — als Platzhalter da, nicht erfunden.
 *
 * Die Cookie-Tabelle dagegen beschreibt tatsächlich vorhandenen Code, keine
 * Annahme: das Supabase-Sitzungscookie (lib/supabase/proxy.ts), das
 * Sprachcookie von next-intl und `vsm_attr` (lib/crm/attribution.ts), seit
 * proxy.ts nur noch nach Einwilligung über `vsm_consent` gesetzt
 * (components/CookieConsentBanner.tsx). Wird an dieser Stelle ein weiteres
 * Cookie oder ein weiterer Auftragsverarbeiter eingeführt, muss diese
 * Tabelle mitwachsen — sie ist die einzige Stelle, die eine Besucherin dazu
 * findet.
 */
export default async function DatenschutzPage() {
  const t = await getTranslations('Datenschutz')

  const sections = [
    { heading: t('controllerHeading'), body: t('controllerBody') },
    { heading: t('overviewHeading'), body: t('overviewBody') },
    { heading: t('hostingHeading'), body: t('hostingBody') },
    { heading: t('accountHeading'), body: t('accountBody') },
    { heading: t('rightsHeading'), body: t('rightsBody') },
    { heading: t('contactHeading'), body: t('contactBody') },
  ]

  const cookies = [
    {
      name: 'sb-*',
      purpose: t('cookieSupabasePurpose'),
      duration: t('cookieSupabaseDuration'),
      category: t('cookieCategoryNecessary'),
    },
    {
      name: 'NEXT_LOCALE',
      purpose: t('cookieLocalePurpose'),
      duration: t('cookieLocaleDuration'),
      category: t('cookieCategoryNecessary'),
    },
    {
      name: 'vsm_consent',
      purpose: t('cookieConsentPurpose'),
      duration: t('cookieConsentDuration'),
      category: t('cookieCategoryNecessary'),
    },
    {
      name: 'vsm_attr',
      purpose: t('cookieAttrPurpose'),
      duration: t('cookieAttrDuration'),
      category: t('cookieCategoryMarketing'),
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>

        <p className="mt-4 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('placeholderNotice')}
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-sm font-semibold text-zinc-950">{section.heading}</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-600">
                {section.body}
              </p>
            </section>
          ))}

          <section>
            <h2 className="text-sm font-semibold text-zinc-950">{t('cookieTableHeading')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{t('cookieTableIntro')}</p>
            <div className="mt-3 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2 font-medium">{t('cookieColName')}</th>
                    <th className="px-4 py-2 font-medium">{t('cookieColPurpose')}</th>
                    <th className="px-4 py-2 font-medium">{t('cookieColDuration')}</th>
                    <th className="px-4 py-2 font-medium">{t('cookieColCategory')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((cookie) => (
                    <tr key={cookie.name} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-zinc-800">{cookie.name}</td>
                      <td className="px-4 py-2 text-zinc-600">{cookie.purpose}</td>
                      <td className="px-4 py-2 text-zinc-600">{cookie.duration}</td>
                      <td className="px-4 py-2 text-zinc-600">{cookie.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
