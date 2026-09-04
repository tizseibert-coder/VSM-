import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import VsmSketch from '@/components/marketing/VsmSketch'
import LeadForm from '@/components/marketing/LeadForm'
import JsonLd from '@/components/seo/JsonLd'
import { localizedUrl, pageMetadata } from '@/lib/seo/site'
import { PUBLIC_TIERS } from '@/lib/billing/plans'
import {
  buttonPrimary,
  buttonPrimaryLg,
  buttonSecondary,
  buttonSecondaryLg,
} from '@/components/ui/buttons'

/**
 * Die Startseite beantwortet die Fragen, die ein Lean-Praktiker in den ersten
 * Sekunden stellt — und zwar mit dem, was tatsächlich gebaut ist: Formeln,
 * Methodikprüfungen und Spaltennamen sind aus dem Produkt übernommen, nicht
 * erfunden. Wer das hier liest und danach das Werkzeug öffnet, findet exakt
 * diese Begriffe wieder.
 *
 * Nicht beantwortet, weil die Antwort nicht im Code steht: wo die Werksdaten
 * liegen. Für den deutschen Industriekunden ist das regelmäßig die Frage, an
 * der eine Beschaffung scheitert. Sie braucht belastbare Angaben zu Standort,
 * Unterauftragsverarbeitern und AVV, bevor hier ein Satz dazu stehen darf.
 */

/**
 * Titel, Beschreibung und die kanonische Adresse dieser Seite.
 *
 * Das Root-Layout setzt bereits Titel und Beschreibung; was hier dazukommt,
 * ist `alternates` — die kanonische Adresse und die Sprachentsprechungen im
 * HTML. Das Layout kann sie nicht setzen, weil es den Pfad der Seite nicht
 * kennt: Jede Unterseite gaebe dort "/de" und "/en" als ihre Entsprechungen
 * an (siehe die Begruendung in i18n/routing.ts).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return pageMetadata({
    locale,
    path: '/',
    title: t('title'),
    description: t('description'),
    ogLocale: t('ogLocale'),
  })
}

// Die Inhalte der vier Wiederholungslisten stehen jetzt in
// messages/{de,en}.json statt hier als Konstanten — sonst gaebe es sie pro
// Sprache einmal im Quelltext. Die Formen bleiben unveraendert; nur die
// Herkunft der Werte hat gewechselt.
type Kpi = { name: string; formula: string; note: string }
type Check = { title: string; body: string }
type ComparisonRow = { label: string; current: string; scenario: string }
type WorkshopItem = { name: string; body: string }
type HostingItem = { role: string; provider: string; note: string }

// Die Schwere pro Methodikbefund bleibt im Code: Sie steuert eine Farbe,
// ist also Darstellung und keine Uebersetzung — in der JSON-Datei waere sie
// eine Einladung, sie beim Uebersetzen versehentlich zu aendern.
const CHECK_SEVERITIES = ['critical', 'warning', 'warning'] as const

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('Home')
  const tNav = await getTranslations('Nav')
  const tPricing = await getTranslations('Pricing')

  const kpis = t.raw('kpis') as Kpi[]
  const checks = t.raw('checks') as Check[]
  const comparison = t.raw('comparison') as ComparisonRow[]
  const workshop = t.raw('workshop') as WorkshopItem[]
  const hosting = t.raw('hosting') as HostingItem[]

  return (
    <main className="bg-white">
      {/* Strukturierte Daten. Hier steht ausschliesslich, was auf der Seite
          auch sichtbar ist — bei Google ist eine Abweichung zwischen
          Auszeichnung und Fliesstext ein Verstoss, der die Domain kostet und
          nicht nur das Suchergebnis. Kein Preis, keine Bewertung, keine
          Anschrift: nichts davon ist belegt. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'VSM Builder',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: t('heroBody'),
          url: localizedUrl(locale, '/'),
          inLanguage: locale,
          featureList: (t.raw('kpis') as Kpi[]).map((kpi) => kpi.name),
        }}
      />

      <header className="border-b border-zinc-200">
        {/* [Bedienbarkeitsprüfung 2026-09-03, B4] Ohne Umbruch braucht diese
            Zeile 435 px — auf einem 390 px breiten Telefon stand "Kostenlos
            starten" zur Hälfte ausserhalb des Bildes, also genau der Knopf, für
            den die Seite geschrieben ist. Die Kopfzeile der Demo-Seite macht es
            seit jeher richtig; hier fehlte flex-wrap. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-5">
          <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/demo" className={buttonSecondary}>
              {tNav('demo')}
            </Link>
            <Link
              href="/pricing"
              className="rounded-control px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {tNav('pricing')}
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
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-700">
              {t('heroBody')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className={buttonPrimaryLg}>
                {t('heroDemoCta')}
              </Link>
              <Link href="/signup" className={buttonSecondaryLg}>
                {t('heroSignupCta')}
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-600">{t('heroNote')}</p>
          </div>

          {/* Das charakteristischste Bild des Fachs steht am Anfang, statt es
              zu beschreiben. */}
          <div className="rounded-surface border border-zinc-200 p-4 sm:p-6">
            <VsmSketch />
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              {t('sketchCaption')}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            {t('kpisTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-700">{t('kpisBody')}</p>

          <dl className="mt-8 border-y border-zinc-200">
            {kpis.map((kpi) => (
              <div
                key={kpi.name}
                className="grid gap-1 border-b border-zinc-200 py-4 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,17rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
              >
                <dt className="font-medium text-zinc-950">{kpi.name}</dt>
                <dd className="font-mono text-sm text-brand-700">{kpi.formula}</dd>
                <dd className="text-sm text-zinc-600">{kpi.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              {t('checksTitle')}
            </h2>
            <p className="mt-3 text-zinc-700">{t('checksBody')}</p>
          </div>
          <ul className="space-y-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200">
            {checks.map((check, i) => (
              <li key={check.title} className="flex gap-3 bg-white px-5 py-4">
                <span
                  aria-hidden
                  className={`mt-2 h-2 w-2 shrink-0 rounded-control ${
                    CHECK_SEVERITIES[i] === 'critical' ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {CHECK_SEVERITIES[i] === 'critical'
                      ? t('severityCritical')
                      : t('severityWarning')}
                  </p>
                  <p className="mt-0.5 font-medium text-zinc-950">{check.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{check.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            {t('comparisonTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-700">{t('comparisonBody')}</p>

          <div className="mt-8 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-5 py-3 text-left font-medium text-zinc-600">
                    {t('comparisonColMetric')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-zinc-950">
                    {t('comparisonColCurrent')}
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-zinc-950">
                    {t('comparisonColScenario')}
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-zinc-100 last:border-0">
                    <td className="px-5 py-3 text-zinc-600">{row.label}</td>
                    <td className="px-5 py-3 text-zinc-950">{row.current}</td>
                    <td className="px-5 py-3 font-medium text-zinc-950">{row.scenario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-600">{t('comparisonNote')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
          {t('workshopTitle')}
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-700">{t('workshopBody')}</p>
        <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {workshop.map((item) => (
            <div key={item.name}>
              <dt className="font-medium text-zinc-950">{item.name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-600">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Die Frage, an der eine Beschaffung in der deutschen Industrie
          regelmaessig scheitert. Hier stehen ausschliesslich bestaetigte
          Angaben: Region, die beiden Anbieter, keine weiteren Empfaenger.
          Zum Auftragsverarbeitungsvertrag steht bewusst nichts, solange
          keiner vorliegt — eine Andeutung waere schlimmer als Schweigen. */}
      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                {t('hostingTitle')}
              </h2>
              <p className="mt-3 text-zinc-700">{t('hostingBody')}</p>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
              {hosting.map((item) => (
                <div key={item.role} className="bg-white px-5 py-5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {item.role}
                  </dt>
                  <dd className="mt-1.5 font-medium text-zinc-950">{item.provider}</dd>
                  <dd className="mt-1 text-sm leading-relaxed text-zinc-600">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Der Tarifausschnitt, nicht die ganze Tabelle: Wer hier landet, will
          wissen, ob es etwas Kostenloses gibt und wo die Grenze liegt. Alles
          Weitere steht auf /pricing — und der Verweis dorthin ist zugleich
          die interne Verlinkung, die die Preisseite ueberhaupt erst
          auffindbar macht. */}
      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              {tPricing('title')}
            </h2>
            <Link href="/pricing" className="text-sm font-medium text-brand-600 hover:underline">
              {tPricing('teaserLink')}
            </Link>
          </div>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLIC_TIERS.map((tier) => (
              <div key={tier} className="bg-white px-5 py-5">
                <dt className="font-medium text-zinc-950">{tPricing(`tier${tier}Name`)}</dt>
                <dd className="mt-1 text-sm text-brand-700">{tPricing(`tier${tier}Price`)}</dd>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {tPricing(`tier${tier}Body`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="kontakt" className="border-t border-zinc-200 bg-zinc-50 scroll-mt-8">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="text-xl font-semibold tracking-tight text-zinc-950">
                {t('ctaTitle')}
              </p>
              <p className="mt-2 max-w-lg text-zinc-700">{t('ctaBody')}</p>
              <Link href="/demo" className={`${buttonPrimaryLg} mt-6 inline-block`}>
                {t('ctaButton')}
              </Link>
            </div>
            <LeadForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-8 text-sm text-zinc-600">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold uppercase tracking-widest text-brand-600">
              VSM Builder
            </span>
            <span>{t('footerTagline')}</span>
          </div>
          {/* Interne Verweise auf die drei oeffentlichen Unterseiten. Eine
              Seite, auf die nichts zeigt, findet auch keine Suchmaschine. */}
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/pricing" className="hover:text-brand-600 hover:underline">
              {tNav('pricing')}
            </Link>
            <Link href="/demo" className="hover:text-brand-600 hover:underline">
              {tNav('demo')}
            </Link>
            <Link href="/data-sheet" className="hover:text-brand-600 hover:underline">
              {tNav('dataSheet')}
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
