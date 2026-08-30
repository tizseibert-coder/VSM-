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
import { TermTooltip } from './TermTooltip'

const PLOT_HEIGHT_PX = 200

export function BalanceChartPanel({
  processes,
  taktTimeMinutes,
}: {
  processes: BalanceProcessInput[]
  taktTimeMinutes: number | null
}) {
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
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          <TermTooltip term="balanceChart">Austaktungsdiagramm</TermTooltip>
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Belegung je Station inkl. OEE-Verlusten, gemessen an der Taktzeit
        </p>
      </div>

      <div className="mt-8 flex gap-3">
        {/* y-axis: only the ceiling and zero — more ticks would not be read. */}
        <div
          className="flex w-10 shrink-0 flex-col justify-between text-right text-[10px] text-zinc-400 dark:text-zinc-500"
          style={{ height: PLOT_HEIGHT_PX }}
          aria-hidden="true"
        >
          <span>{axisMax.toFixed(1)}</span>
          <span>0 min</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Plot area: bars only, so a full-height bar cannot push anything
              out of the card. */}
          <div className="relative" style={{ height: PLOT_HEIGHT_PX }}>
            {taktLinePercent !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-blue-600 dark:border-blue-400"
                style={{ bottom: `${taktLinePercent}%` }}
              >
                <span className="absolute -top-5 right-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-blue-500">
                  Takt {chart.taktTimeMinutes?.toFixed(1)} min
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
                        bar.isOverTakt ? 'bg-red-300 dark:bg-red-900' : 'bg-zinc-300 dark:bg-zinc-600'
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
                      bar.isOverTakt ? 'bg-red-600 dark:bg-red-500' : 'bg-emerald-600 dark:bg-emerald-500'
                    } ${bar.isBottleneck ? 'ring-2 ring-inset ring-zinc-950 dark:ring-zinc-50' : ''}`}
                  />
                </li>
              ))}
            </ol>
          </div>

          {/* Labels as their own row — this is also the accessible version of
              the chart, so the bars above are hidden from the tree. */}
          <ol className="mt-2 flex gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            {chart.bars.map((bar) => (
              <li key={bar.id} className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200" title={bar.name}>
                  {bar.name}
                </p>
                <p className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {Number.isFinite(bar.totalMinutes) ? `${bar.totalMinutes.toFixed(2)} min` : 'keine Kapazität'}
                  {bar.taktRatio !== null && Number.isFinite(bar.taktRatio) && (
                    <span className={bar.isOverTakt ? ' text-red-600 dark:text-red-400' : ''}>
                      {' '}
                      · {(bar.taktRatio * 100).toFixed(0)} %
                    </span>
                  )}
                </p>
                {bar.isBottleneck && (
                  <p className="text-[10px] font-medium text-zinc-950 dark:text-zinc-50">Engpass</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" /> Arbeit im Takt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600 dark:bg-red-500" /> Arbeit über Takt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600" /> OEE-Verlust
        </span>
      </div>

      {chart.minimumStations !== null && (
        <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Arbeitsinhalt {chart.totalWorkContentMinutes.toFixed(1)} min ÷ Takt{' '}
          {chart.taktTimeMinutes?.toFixed(1)} min ={' '}
          <strong className="font-semibold text-zinc-950 dark:text-zinc-50">
            mindestens {chart.minimumStations} taktkonforme Stationen
          </strong>{' '}
          — aktuell sind es {chart.bars.length}.
          {chart.minimumStations > chart.bars.length &&
            ' Solange die Arbeit auf weniger Stationen verteilt ist, kann die Linie den Kundenbedarf rechnerisch nicht decken.'}
        </p>
      )}
    </section>
  )
}
