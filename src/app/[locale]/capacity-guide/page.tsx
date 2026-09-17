import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { pageMetadata } from '@/lib/seo/site'
import { CAMA_BADGE_CLASS, CAMA_EMOJI } from '@/components/VSMEditor/camaColors'
import { buttonPrimaryLg } from '@/components/ui/buttons'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'CapacityGuide' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/capacity-guide',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

type Step = { title: string; body: string }

// Dieselbe Reihenfolge wie CAMA_EMOJI/CAMA_BADGE_CLASS (camaColors.ts) —
// keine zweite Liste, die einmal von der echten Ampel abweichen könnte.
const CAMA_COLOR_ORDER = ['blue', 'green', 'orange', 'red'] as const

/**
 * Die öffentliche, ausführliche Anleitung zum Kapazitätsmanagement — das
 * Gegenstück zum kurzen <details>-Block auf /capacity selbst (der ist hinter
 * der Anmeldung, für Suchmaschinen unsichtbar). Nutzerentscheidung
 * 2026-09-17 ("Beides"): kurzer In-App-Hinweis plus Link hierher.
 *
 * Folgt demselben öffentlichen Seitenmuster wie /data-sheet: SEO-Inhalt mit
 * Signup-CTA, keine Anmeldung nötig. Ampel-Farben, Emoji und
 * Handlungsempfehlungen kommen aus derselben Quelle wie /capacity selbst
 * (camaColors.ts, Capacity-Namensraum) statt einer zweiten Beschreibung, die
 * irgendwann von der echten Ampel abweichen könnte.
 */
export default async function CapacityGuidePage() {
  const t = await getTranslations('CapacityGuide')
  const tCapacity = await getTranslations('Capacity')

  const steps = t.raw('steps') as Step[]

  const recommendationKey = {
    blue: 'recommendationBlue',
    green: 'recommendationGreen',
    orange: 'recommendationOrange',
    red: 'recommendationRed',
  } as const
  const colorLabelKey = {
    blue: 'colorBlue',
    green: 'colorGreen',
    orange: 'colorOrange',
    red: 'colorRed',
  } as const

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="text-xs font-semibold uppercase tracking-widest text-brand-600 hover:underline">
          {t('eyebrow')}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
        <p className="mt-4 max-w-2xl text-zinc-700">{t('intro')}</p>

        <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-950">{t('stepsTitle')}</h2>
        <ol className="mt-6 space-y-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-50 text-sm font-semibold text-brand-700">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-zinc-950">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-xl font-semibold tracking-tight text-zinc-950">{t('ampelTitle')}</h2>
        <dl className="mt-6 divide-y divide-zinc-200 rounded-surface border border-zinc-200">
          {CAMA_COLOR_ORDER.map((color) => (
            <div key={color} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="shrink-0 sm:w-40">
                <span
                  className={`inline-flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-medium ${CAMA_BADGE_CLASS[color]}`}
                >
                  {CAMA_EMOJI[color]} {tCapacity(colorLabelKey[color])}
                </span>
              </dt>
              <dd className="text-sm leading-relaxed text-zinc-600">{tCapacity(recommendationKey[color])}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-zinc-500">{tCapacity('legend')}</p>

        <div className="mt-12 rounded-surface border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-lg font-semibold tracking-tight text-zinc-950">{t('ctaTitle')}</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-700">{t('ctaBody')}</p>
          <Link href="/signup" className={`${buttonPrimaryLg} mt-5 inline-block`}>
            {t('ctaButton')}
          </Link>
        </div>
      </div>
    </div>
  )
}
