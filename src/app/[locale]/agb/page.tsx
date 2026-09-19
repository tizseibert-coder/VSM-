import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo/site'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Agb' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/agb',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

/**
 * Stand, ab dem der Inhalt gilt. Von Hand nachfuehren, wenn sich ein
 * Abschnitt inhaltlich aendert (z. B. Preise, Kuendigungsweg) — siehe
 * dieselbe Begruendung in impressum/page.tsx.
 */
const LAST_UPDATED = new Date('2026-09-19')

const SECTIONS = [
  'scope',
  'conclusion',
  'service',
  'price',
  'term',
  'rights',
  'availability',
  'liability',
  'privacy',
  'changes',
  'law',
  'final',
] as const

export default async function AgbPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('Agb')
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(LAST_UPDATED)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t('intro')}</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
        {SECTIONS.map((section) => (
          <section key={section}>
            <h2 className="text-base font-semibold text-zinc-950">{t(`${section}Title`)}</h2>
            <p className="mt-2">{t(`${section}Body`)}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        {t('lastUpdated', { date })}
      </p>
    </main>
  )
}
