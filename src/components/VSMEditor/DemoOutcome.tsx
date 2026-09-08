'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { compareDemoState, type OutcomeKey, type OutcomeMetric } from '@/lib/vsm/demoOutcome'
import { formatDecimal } from '@/lib/vsm/numberFormat'
import type { VsmState } from '@/lib/vsm/vsmStore'
import { buttonPrimaryLg, buttonSecondaryLg } from '@/components/ui/buttons'

/**
 * Der Abschluss unter der Demo.
 *
 * [Marketing-Audit 2026-09-07, A1] Die Demo endete bisher mit dem Canvas und
 * sonst nichts. Der Moment, in dem eine Kennzahl auf eine Eingabe reagiert,
 * ist die einzige Stelle im ganzen Trichter, an der sich der Zustand des
 * Lesers aendert — und danach stand kein Wort mehr auf der Seite. Die
 * Handlungsangebote lagen ausschliesslich in der Kopfzeile, also dort, wo sie
 * schon standen, bevor er irgendetwas erlebt hatte.
 *
 * Zwei Fassungen, nie beide: Wer etwas gerechnet hat, bekommt seine eigenen
 * Zahlen zu lesen; wer nur gelesen hat, den ruhigen Abschluss. Zweimal
 * dasselbe Angebot untereinander laesst den Leser ueberlegen, ob die Knoepfe
 * Verschiedenes tun — dieselbe Ueberlegung steht im Dashboard ueber dem
 * Leerzustand.
 *
 * [Marketing-Audit 2026-09-07, A2] Der Primaerknopf hiess bis zum 07.09.
 * "Kostenlos starten", weil die Demo ihren Zustand beim Neuladen verwarf und
 * "wir behalten das fuer Sie" damit eine Falschangabe gewesen waere — an
 * genau der Stelle, an der jemand gerade Vertrauen fasst. Seit der Zustand im
 * Browser liegt und die Anmeldung uebersteht, heisst der Knopf nach dem, was
 * er tut, und nimmt das Ziel mit: `?from=demo` sagt der Registrierung, dass
 * sie es erwaehnen soll.
 */

/** Einheit und Nachkommastellen je Kennzahl — dieselben wie im Editor, damit
 *  dieselbe Zahl nicht zweimal verschieden geschrieben dasteht. */
const DISPLAY: Record<OutcomeKey, { unitKey: string; digits: number }> = {
  leadTime: { unitKey: 'unitDays', digits: 1 },
  valueAddedRatio: { unitKey: 'unitPercent', digits: 2 },
  exitRate: { unitKey: 'unitPiecesPerDay', digits: 1 },
}

/** Die Beschriftung in der Zeile (Nominativ) und die im Satz (Akkusativ mit
 *  Artikel) sind im Deutschen nicht dieselbe Zeichenkette. */
const ROW_LABEL_KEY: Record<OutcomeKey, string> = {
  leadTime: 'kpiLeadTime',
  valueAddedRatio: 'kpiPce',
  exitRate: 'kpiExitRate',
}

const SENTENCE_KEY: Record<OutcomeKey, string> = {
  leadTime: 'metricLeadTime',
  valueAddedRatio: 'metricValueAddedRatio',
  exitRate: 'metricExitRate',
}

/**
 * Beide Werte einer Zeile so genau schreiben, dass die Bewegung sichtbar wird.
 *
 * Der Wertschoepfungsanteil liegt in einem echten Wertstrom im
 * Promillebereich — der Demo-Datensatz ist genau dafuer gebaut. Mit den zwei
 * Nachkommastellen des Editors stand dort "0,03 auf 0,03 %" neben einem
 * Ausschlag von 9,2 %: eine Zeile, die sich selbst widerspricht, und zwar an
 * der Stelle, an der das Werkzeug seine Genauigkeit beweisen soll.
 *
 * Ergaenzt werden nur so viele Stellen, bis die beiden Zahlen verschieden
 * aussehen. Mehr als drei zusaetzliche waeren keine Genauigkeit mehr, sondern
 * Rauschen — dann bleibt es bei der Vorgabe, und die Prozentangabe daneben
 * traegt die Aussage allein.
 */
function pairDigits(before: number, after: number, locale: string, base: number): number {
  for (let digits = base; digits <= base + 3; digits += 1) {
    if (formatDecimal(before, locale, digits) !== formatDecimal(after, locale, digits)) {
      return digits
    }
  }
  return base
}

export default function DemoOutcome({
  initial,
  current,
}: {
  initial: VsmState
  current: VsmState
}) {
  const t = useTranslations('Demo.outcome')
  const tEditor = useTranslations('Editor')
  const tNav = useTranslations('Nav')
  const locale = useLocale()

  const outcome = useMemo(() => compareDemoState(initial, current), [initial, current])
  const headline = outcome.headline

  const digitsFor = (metric: OutcomeMetric) =>
    pairDigits(metric.before, metric.after, locale, DISPLAY[metric.key].digits)

  // Wer etwas gerechnet hat, hat auch etwas zu uebernehmen — der Knopf sagt
  // dann das, und nicht "Kostenlos starten".
  const actions = (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={headline ? '/signup?from=demo' : '/signup'}
        className={buttonPrimaryLg}
      >
        {headline ? t('ctaTakeOver') : tNav('signup')}
      </Link>
      <Link href="/pricing" className={buttonSecondaryLg}>
        {t('ctaPricing')}
      </Link>
    </div>
  )

  // Der ruhige Abschluss: Er traegt die Leser, die nur gelesen haben, und er
  // ist zugleich der Ausgang, den die Seite bisher gar nicht hatte — eine
  // Seite ohne weiterfuehrenden Verweis ist auch fuer eine Suchmaschine eine
  // Sackgasse.
  if (!headline) {
    return (
      <section aria-labelledby="demo-outcome-title" className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2
            id="demo-outcome-title"
            className="text-balance text-2xl font-semibold tracking-tight text-zinc-950"
          >
            {t('closingTitle')}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-zinc-700">{t('closingBody')}</p>
          {actions}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="demo-outcome-title" className="border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-surface border border-brand-200 bg-brand-50 p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
            <div>
              <h2
                id="demo-outcome-title"
                className="text-balance text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl"
              >
                {t('headline', {
                  metric: t(SENTENCE_KEY[headline.key]),
                  before: formatDecimal(headline.before, locale, digitsFor(headline)),
                  after: formatDecimal(headline.after, locale, digitsFor(headline)),
                  unit: tEditor(DISPLAY[headline.key].unitKey),
                })}
              </h2>

              <p className="mt-3 max-w-xl leading-relaxed text-zinc-700">
                {headline.improved ? t('bodyImproved') : t('bodyWorsened')}
              </p>

              {actions}

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-600">
                {t('noteKept')}
              </p>
            </div>

            {/* Alle bewegten Kennzahlen, nicht nur die aus der Ueberschrift:
                Wer eine Zykluszeit aendert, bewegt regelmaessig mehrere davon,
                und genau dieser Zusammenhang ist das Argument des Werkzeugs. */}
            <div className="rounded-control border border-brand-200 bg-white p-5">
              <dl className="space-y-3.5">
                {outcome.metrics.map((metric: OutcomeMetric) => {
                  const digits = digitsFor(metric)
                  return (
                  <div
                    key={metric.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4"
                  >
                    <dt className="text-sm text-zinc-600">{tEditor(ROW_LABEL_KEY[metric.key])}</dt>
                    <dd
                      className={`text-right text-sm font-medium tabular-nums ${
                        metric.improved ? 'text-brand-700' : 'text-zinc-600'
                      }`}
                    >
                      {metric.changePercent === null
                        ? null
                        : t('change', {
                            value: `${metric.changePercent > 0 ? '+' : '−'}${formatDecimal(
                              Math.abs(metric.changePercent),
                              locale,
                              1
                            )}`,
                          })}
                    </dd>
                    <dd className="col-span-2 mt-0.5 text-sm tabular-nums text-zinc-950">
                      {formatDecimal(metric.before, locale, digits)}
                      <span className="sr-only"> {t('toWord')} </span>
                      <span aria-hidden className="px-1.5 text-zinc-500">
                        →
                      </span>
                      <span className="font-medium">
                        {formatDecimal(metric.after, locale, digits)}{' '}
                        {tEditor(DISPLAY[metric.key].unitKey)}
                      </span>
                    </dd>
                  </div>
                  )
                })}
              </dl>
              <p className="mt-4 border-t border-zinc-200 pt-3 text-xs leading-relaxed text-zinc-600">
                {t('metricsCaption')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
