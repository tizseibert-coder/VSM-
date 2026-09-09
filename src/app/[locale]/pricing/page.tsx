import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import JsonLd from '@/components/seo/JsonLd'
import LeadForm from '@/components/marketing/LeadForm'
import HeaderLocaleSwitcher from '@/components/HeaderLocaleSwitcher'
import { PLANS, PUBLIC_TIERS, tierRank, type Tier } from '@/lib/billing/plans'
import { isPurchasableTier, isTierPurchasable } from '@/lib/billing/stripe'
import { tierPriceParams, visitorCurrency } from '@/lib/billing/currency'
import { startCheckout } from './actions'
import { localizedUrl, pageMetadata, SITE_NAME } from '@/lib/seo/site'
import {
  buttonPrimary,
  buttonPrimaryLg,
  buttonSecondary,
  buttonSecondaryLg,
} from '@/components/ui/buttons'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Pricing' })
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/pricing',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ogLocale: tMeta('ogLocale'),
  })
}

const ORDERED: readonly Tier[] = [...PUBLIC_TIERS].sort((a, b) => tierRank(a) - tierRank(b))

/**
 * Die Preisseite.
 *
 * Die Zahlen in der Tabelle kommen aus `lib/billing/plans.ts` — derselben
 * Datei, gegen die `createProject` prueft. Eine handgepflegte Tabelle daneben
 * waere binnen einer Aenderung falsch, und Falschangaben auf der Preisseite
 * sind die teuerste Sorte Fehler in diesem Projekt.
 *
 * Was hier *nicht* steht, sind Beträge: Die Preise sind nicht festgelegt, und
 * eine erfundene Zahl auf einer Seite, die strukturierte Daten an Google
 * liefert, waere kein Platzhalter, sondern eine Falschangabe im
 * Suchergebnis. Solange in messages/*.json unter `Pricing.price*` „auf
 * Anfrage" steht, sagt die Seite genau das — und das JSON-LD nennt nur die
 * eine Zahl, die feststeht: die kostenlose Stufe kostet null.
 */
export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { locale } = await params
  const { error } = await searchParams
  const t = await getTranslations('Pricing')
  const tNav = await getTranslations('Nav')
  const tHome = await getTranslations('Home')
  const tErr = await getTranslations('Errors')
  const currency = await visitorCurrency()

  // Die drei Faelle, die startCheckout() ueber die Weiterleitung meldet
  // (siehe pricing/actions.ts) — kein generisches "error", weil "Sie sind
  // nicht Inhaber dieser Organisation" etwas anderes bedeutet als ein
  // fehlgeschlagener Zahlungsanbieter.
  const errorMessage =
    error === 'notOwner'
      ? tErr('checkoutNotOwner')
      : error === 'noOrg'
        ? tErr('checkoutNoOrg')
        : error === 'notConfigured'
          ? tErr('checkoutNotConfigured')
          : error
            ? decodeURIComponent(error)
            : null

  const featureRows = [
    { key: 'maxProjects', value: (tier: Tier) => numberOrInfinity(PLANS[tier].maxProjects) },
    {
      key: 'maxScenariosPerProject',
      value: (tier: Tier) => numberOrInfinity(PLANS[tier].maxScenariosPerProject),
    },
    { key: 'maxMembers', value: (tier: Tier) => numberOrInfinity(PLANS[tier].maxMembers) },
    { key: 'pdfExport', value: (tier: Tier) => yesNo(PLANS[tier].pdfExport) },
    { key: 'csvImport', value: (tier: Tier) => yesNo(PLANS[tier].csvImport) },
    { key: 'benchmark', value: (tier: Tier) => yesNo(PLANS[tier].benchmark) },
  ] as const

  function numberOrInfinity(value: number | null): string {
    return value === null ? t('unlimited') : String(value)
  }
  function yesNo(value: boolean): string {
    return value ? t('included') : t('notIncluded')
  }

  const faq = t.raw('faq') as { question: string; answer: string }[]

  return (
    <main className="bg-white">
      {/* FREE, STARTER und PROFESSIONAL tragen jetzt einen echten Betrag,
          seit die Selbstbedienungspreise feststehen (04.09.2026) — vorher
          stand hier nur FREE, weil ein Angebot ohne Preis in schema.org kein
          gueltiges Angebot ist und eines mit erfundenem Preis schlimmer waere
          als keines. ENTERPRISE bleibt ohne Offer: "Preis auf Anfrage" ist
          weiterhin kein Preis.

          Bewusst weiterhin EUR, nicht die Waehrung dieser Anfrage: Googlebot
          crawlt von einem festen Standort aus, nicht von jedem Besucherland
          einzeln — ein personalisiertes Angebot hier waere fuer die
          Suchmaschine kein zusaetzlich richtiger Wert, sondern ein
          zufaelliger. Die sichtbare Seite darunter zeigt dagegen Franken,
          wenn die Anfrage aus der Schweiz kommt (siehe billing/currency.ts)
          — beides real angebotene Preise, nur an unterschiedliche Adressaten
          gerichtet. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_NAME,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: t('metaDescription'),
          url: localizedUrl(locale, '/'),
          inLanguage: locale,
          offers: [
            {
              '@type': 'Offer',
              name: t('tierFREEName'),
              price: 0,
              priceCurrency: 'EUR',
              url: localizedUrl(locale, '/signup'),
              availability: 'https://schema.org/InStock',
            },
            {
              '@type': 'Offer',
              name: t('tierSTARTERName'),
              price: 12,
              priceCurrency: 'EUR',
              url: `${localizedUrl(locale, '/pricing')}#kontakt`,
              availability: 'https://schema.org/InStock',
            },
            {
              '@type': 'Offer',
              name: t('tierPROFESSIONALName'),
              price: 49,
              priceCurrency: 'EUR',
              url: `${localizedUrl(locale, '/pricing')}#kontakt`,
              availability: 'https://schema.org/InStock',
            },
          ],
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }}
      />

      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-5">
          <Link
            href="/"
            className="whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-brand-600"
          >
            {SITE_NAME}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/demo" className={buttonSecondary}>
              {tNav('demo')}
            </Link>
            {/* [Marketing-Audit 2026-09-07, A6] Bisher nur in der Fusszeile
                verlinkt — genau der Bogen, der als Suchtreffer die meisten
                neuen Besucher bringen koennte, war in der Kopfzeile nicht zu
                finden. */}
            <Link
              href="/data-sheet"
              className="rounded-control px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {tNav('dataSheet')}
            </Link>
            <Link
              href="/login"
              className="rounded-control px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {tNav('login')}
            </Link>
            <Link href="/signup" className={buttonPrimary}>
              {tNav('signup')}
            </Link>
            <HeaderLocaleSwitcher />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-12 pt-14">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-700">{t('body')}</p>
        {errorMessage && (
          <p className="mt-4 max-w-2xl rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="mt-10 grid gap-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200 lg:grid-cols-4">
          {ORDERED.map((tier) => (
            <div key={tier} className="flex flex-col bg-white px-5 py-6">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                {t(`tier${tier}Name`)}
              </h2>
              <p className="mt-1 text-sm text-brand-700">
                {t(`tier${tier}Price`, tierPriceParams(tier, currency, locale))}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-600">
                {t(`tier${tier}Body`)}
              </p>
              {tier === 'FREE' ? (
                <Link href="/signup" className={`${buttonPrimary} mt-5 text-center`}>
                  {t('ctaFree')}
                </Link>
              ) : isPurchasableTier(tier) && isTierPurchasable(tier) ? (
                // Serverseitiges Formular statt eines Links: Ein Kauf ist
                // eine Handlung mit Nebenwirkung (er legt einen Stripe-Kunden
                // an, wenn noch keiner existiert) und gehoert deshalb hinter
                // ein POST, nicht hinter ein GET, das ein Vorschau-Roboter
                // oder ein Wiederholen der Adresse versehentlich ausloesen
                // koennte.
                <form action={startCheckout.bind(null, tier)} className="mt-5">
                  <button type="submit" className={`${buttonSecondary} w-full`}>
                    {t('ctaSubscribe')}
                  </button>
                </form>
              ) : (
                // Ohne eingerichtetes Stripe (lokale Entwicklung, oder bevor
                // die Preis-Ids gesetzt sind) faellt die Stufe auf denselben
                // Anfrage-Weg zurueck wie ENTERPRISE — kein kaputter Knopf,
                // nur ein Weg, der laenger dauert.
                <Link href="#kontakt" className={`${buttonSecondary} mt-5 text-center`}>
                  {t('ctaContact')}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* [Marketing-Audit 2026-09-07, B5] Fehlte bisher vollstaendig: Fuer
            12 EUR bzw. 49 EUR im Monat stand kein einziger risikomindernder
            Satz auf der Seite. Direkt unter den Knoepfen, dorthin, wo die
            Hand zoegert — nicht in der FAQ darunter, wo sie erst nach dem
            Scrollen an der Entscheidung vorbei sichtbar wird.

            Bewusst *nicht* "monatlich kuendbar": Es gibt aktuell keinen
            Selbstbedienungsweg zur Kuendigung (kein Kundenportal, keine
            Funktion im Dashboard) — dieser Satz waere eine Zusage ohne
            Deckung gewesen, genau die Sorte Fehler, die dieses Audit an
            anderer Stelle kritisiert. "Keine Mindestlaufzeit" ist die
            Aussage, die der Checkout tatsaechlich traegt: mode: 'subscription'
            ohne Bindungsklausel (siehe pricing/actions.ts). */}
        <p className="mt-4 text-sm text-zinc-600">{t('riskReversal')}</p>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            {t('comparisonTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-700">{t('comparisonBody')}</p>

          <div className="mt-8 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-5 py-3 text-left font-medium text-zinc-600">
                    {t('comparisonColFeature')}
                  </th>
                  {ORDERED.map((tier) => (
                    <th key={tier} className="px-5 py-3 text-left font-medium text-zinc-950">
                      {t(`tier${tier}Name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {featureRows.map((row) => (
                  <tr key={row.key} className="border-b border-zinc-100 last:border-0">
                    <td className="px-5 py-3 text-zinc-600">{t(`feature_${row.key}`)}</td>
                    {ORDERED.map((tier) => (
                      <td key={tier} className="px-5 py-3 text-zinc-950">
                        {row.value(tier)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('faqTitle')}</h2>
        <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {faq.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-zinc-950">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="kontakt" className="border-t border-zinc-200 bg-zinc-50 scroll-mt-8">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                {t('contactTitle')}
              </h2>
              <p className="mt-3 text-zinc-700">{t('contactBody')}</p>
              <Link href="/demo" className={`${buttonSecondaryLg} mt-5 inline-block`}>
                {tNav('demo')}
              </Link>
            </div>
            <LeadForm source="pricing" />
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-12">
          <p className="text-xl font-semibold tracking-tight text-zinc-950">{t('ctaTitle')}</p>
          <Link href="/signup" className={buttonPrimaryLg}>
            {t('ctaFree')}
          </Link>
        </div>
      </section>

      {/* [Marketing-Audit 2026-09-07, C7] Die Seite endete bisher mit der
          Abschluss-Zeile: kein Verweis, der weiterfuehrt. Wer hier zoegert,
          hatte nur die Zurueck-Taste — und eine Suchmaschine keinen Pfad zu
          Demo oder Erhebungsbogen von hier aus. Derselbe Fussbereich wie auf
          Startseite und Demo. */}
      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-8 text-sm text-zinc-600">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href="/"
              className="font-semibold uppercase tracking-widest text-brand-600 hover:underline"
            >
              {SITE_NAME}
            </Link>
            <span>{tHome('footerTagline')}</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/demo" className="hover:text-brand-600 hover:underline">
              {tNav('demo')}
            </Link>
            <Link href="/data-sheet" className="hover:text-brand-600 hover:underline">
              {tNav('dataSheet')}
            </Link>
            <Link href="/login" className="hover:text-brand-600 hover:underline">
              {tNav('login')}
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
