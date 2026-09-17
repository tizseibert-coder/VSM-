import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/site'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Impressum' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/impressum',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

/**
 * Das Gerüst für die Anbieterkennzeichnung nach § 5 DDG (vormals § 5 TMG)
 * und § 18 Abs. 2 MStV.
 *
 * Absichtlich mit Platzhaltern statt erfundenen Angaben: Firmenname,
 * Anschrift, Vertretungsberechtigte, Handelsregisternummer und USt-IdNr.
 * stehen hier nicht im Code, weil sie nirgends sonst im Repository geprüft
 * vorliegen (dieselbe Zurückhaltung wie schon auf der Startseite, siehe den
 * Kommentar dort zum Hosting-Standort) — falsche oder erfundene Angaben in
 * einem Impressum sind ein eigener Wettbewerbsverstoß, eine fehlende Seite
 * "nur" eine Lücke. Jeder Platzhalter ist als solcher in der Übersetzung
 * markiert (`[…]`) und muss vor Veröffentlichung durch geprüfte Angaben
 * ersetzt werden.
 */
export default async function ImpressumPage() {
  const t = await getTranslations('Impressum')

  const sections = [
    { heading: t('providerHeading'), body: t('providerBody') },
    { heading: t('representedByHeading'), body: t('representedByBody') },
    { heading: t('contactHeading'), body: t('contactBody') },
    { heading: t('registerHeading'), body: t('registerBody') },
    { heading: t('vatHeading'), body: t('vatBody') },
    { heading: t('responsibleHeading'), body: t('responsibleBody') },
    { heading: t('disputeHeading'), body: t('disputeBody') },
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
        </div>
      </div>
    </div>
  )
}
