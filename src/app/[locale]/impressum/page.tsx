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
 * Stand, ab dem der Inhalt gilt. Von Hand nachfuehren, wenn sich ein
 * Abschnitt inhaltlich aendert (Handelsregister-Eintrag, neue Adresse) — ein
 * automatisches "heute" waere hier falsch, weil es nichts ueber den Inhalt
 * aussagt, nur ueber den Seitenaufruf.
 */
const LAST_UPDATED = new Date('2026-09-19')

export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('Impressum')
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(LAST_UPDATED)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t('intro')}</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('providerTitle')}</h2>
          <p className="mt-2">{t('providerName')}</p>
          <p>{t('providerTrade')}</p>
          <p>{t('providerAddress')}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('contactTitle')}</h2>
          <p className="mt-2">{t('contactEmail')}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('registerTitle')}</h2>
          <p className="mt-2">{t('registerBody')}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('liabilityTitle')}</h2>
          <p className="mt-2">{t('liabilityBody')}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('linksTitle')}</h2>
          <p className="mt-2">{t('linksBody')}</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-950">{t('copyrightTitle')}</h2>
          <p className="mt-2">{t('copyrightBody')}</p>
        </section>
      </div>

      <p className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        {t('lastUpdated', { date })}
      </p>
    </main>
  )
}
