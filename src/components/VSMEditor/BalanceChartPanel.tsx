'use client'

// Austaktungsdiagramm (Yamazumi). One bar per station against a horizontal
// takt line — the balancing view the VSM timeline cannot provide, because that
// one is ordered by position in the stream and carries no takt reference.
//
// Plain divs rather than a chart library: four to a dozen bars with a single
// reference line does not justify a dependency, and percentage heights inside
// a fixed-height plot area stay readable at any container width.
//
// Layout note: the plot area and the labels are deliberately two separate
// rows. Putting the label inside the same fixed-height column made the bar
// (sized as a percentage of that height) overflow upwards out of the card as
// soon as it approached full height — the tall bars were clipped.

import { buildBalanceChart, type BalanceProcessInput } from '@/lib/vsm/balance'
import { useLocale, useTranslations } from 'next-intl'
import { formatDecimal } from '@/lib/vsm/numberFormat'
import { TermTooltip } from './TermTooltip'

const PLOT_HEIGHT_PX = 200

export function BalanceChartPanel({
  processes,
  taktTimeMinutes,
}: {
  processes: BalanceProcessInput[]
  taktTimeMinutes: number | null
}) {
  const t = useTranslations('Balance')
  const locale = useLocale()
  const num = (value: number, digits = 1) => formatDecimal(value, locale, digits)
  const chart = buildBalanceChart(processes, taktTimeMinutes)

  if (chart.bars.length === 0) {
    return null
  }

  // Headroom so the tallest bar does not touch the top edge and the takt badge
  // stays readable when the line sits near the top.
  const axisMax = chart.scaleMaxMinutes * 1.12
  const heightPercent = (minutes: number) =>
    Number.isFinite(minutes) ? Math.min((minutes / axisMax) * 100, 100) : 100
  const taktLinePercent = chart.taktTimeMinutes !== null ? (chart.taktTimeMinutes / axisMax) * 100 : null

  return (
    <section className="rounded-surface border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-950">
          <TermTooltip term="balanceChart">{t('title')}</TermTooltip>
        </h2>
        <p className="text-xs text-zinc-500">
          {t('subtitle')}
        </p>
      </div>

      <div className="mt-8 flex gap-3">
        {/* y-axis: only the ceiling and zero — more ticks would not be read. */}
        <div
          className="flex w-12 shrink-0 flex-col justify-between text-right text-xs text-zinc-600"
          style={{ height: PLOT_HEIGHT_PX }}
          aria-hidden="true"
        >
          <span>{num(axisMax)}</span>
          <span>{t('zeroAxis')}</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Plot area: bars only, so a full-height bar cannot push anything
              out of the card. */}
          <div className="relative" style={{ height: PLOT_HEIGHT_PX }}>
            {taktLinePercent !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-brand-600"
                style={{ bottom: `${taktLinePercent}%` }}
              >
                <span className="absolute -top-6 right-0 rounded-control bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
                  {t('taktLabel', { value: chart.taktTimeMinutes !== null ? num(chart.taktTimeMinutes) : '' })}
                </span>
              </div>
            )}

            <ol className="flex h-full items-end gap-2" aria-hidden="true">
              {chart.bars.map((bar) => (
                <li
                  key={bar.id}
                  className="flex flex-1 flex-col justify-end overflow-hidden"
                  style={{ height: `${heightPercent(bar.totalMinutes)}%` }}
                >
                  {/* The OEE loss sits on top of the productive part: it is
                      what pushes an otherwise fine station over the line. */}
                  {bar.lossMinutes > 0 && (
                    <div
                      className={`shrink-0 rounded-t ${
                        bar.isOverTakt ? 'bg-red-300' : 'bg-zinc-300'
                      }`}
                      style={{
                        height: Number.isFinite(bar.totalMinutes)
                          ? `${(bar.lossMinutes / bar.totalMinutes) * 100}%`
                          : '30%',
                      }}
                    />
                  )}
                  <div
                    className={`min-h-0 flex-1 ${bar.lossMinutes > 0 ? '' : 'rounded-t'} ${
                      bar.isOverTakt ? 'bg-red-600' : 'bg-emerald-600'
                    } ${bar.isBottleneck ? 'ring-2 ring-inset ring-zinc-950' : ''}`}
                  />
                </li>
              ))}
            </ol>
          </div>

          {/* Labels as their own row — this is also the accessible version of
              the chart, so the bars above are hidden from the tree. */}
          <ol className="mt-2 flex gap-2 border-t border-zinc-200 pt-2">
            {chart.bars.map((bar) => (
              <li key={bar.id} className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs font-medium text-zinc-800" title={bar.name}>
                  {bar.name}
                </p>
                <p className="text-xs tabular-nums text-zinc-500">
                  {Number.isFinite(bar.totalMinutes) ? `${num(bar.totalMinutes, 2)} min` : t('noCapacity')}
                  {bar.taktRatio !== null && Number.isFinite(bar.taktRatio) && (
                    <span className={bar.isOverTakt ? ' text-red-600' : ''}>
                      {' '}
                      · {num(bar.taktRatio * 100, 0)} %
                    </span>
                  )}
                </p>
                {bar.isBottleneck && (
                  <p className="text-xs font-medium text-zinc-950">{t('bottleneck')}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> {t('legendInTakt')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> {t('legendOverTakt')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> {t('legendOeeLoss')}
        </span>
      </div>

      {chart.minimumStations !== null && (
        <p className="mt-4 rounded-control bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {t('minStationsPrefix', {
            work: num(chart.totalWorkContentMinutes),
            takt: chart.taktTimeMinutes !== null ? num(chart.taktTimeMinutes) : '',
          })}{' '}
          <strong className="font-semibold text-zinc-950">
            {t('minStationsStrong', { count: chart.minimumStations })}
          </strong>{' '}
          {t('minStationsSuffix', { actual: chart.bars.length })}
          {chart.minimumStations > chart.bars.length && t('minStationsWarning')}
        </p>
      )}
    </section>
  )
}
