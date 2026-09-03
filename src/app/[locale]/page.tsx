import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import VsmSketch from '@/components/marketing/VsmSketch'
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

export default async function Home() {
  const t = await getTranslations('Home')
  const tNav = await getTranslations('Nav')

  const kpis = t.raw('kpis') as Kpi[]
  const checks = t.raw('checks') as Check[]
  const comparison = t.raw('comparison') as ComparisonRow[]
  const workshop = t.raw('workshop') as WorkshopItem[]
  const hosting = t.raw('hosting') as HostingItem[]

  return (
    <main className="bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <div className="flex items-center gap-2">
            <Link href="/demo" className={buttonSecondary}>
              {tNav('demo')}
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

      <section className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-14">
          <div>
            <p className="text-xl font-semibold tracking-tight text-zinc-950">
              {t('ctaTitle')}
            </p>
            <p className="mt-2 max-w-lg text-zinc-700">{t('ctaBody')}</p>
          </div>
          <Link href="/demo" className={buttonPrimaryLg}>
            {t('ctaButton')}
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 gap-y-1 px-6 py-8 text-sm text-zinc-600">
          <span className="font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <span>{t('footerTagline')}</span>
        </div>
      </footer>
    </main>
  )
}
