import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import PrintButton from '@/components/wizard/PrintButton'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('DataSheet')
  return { title: t('metaTitle'), description: t('metaDescription') }
}

/** So viele Zeilen, wie auf eine Seite passen. Eine Kette mit mehr als zwölf
 *  Stationen ist selten, und wer sie hat, druckt den Bogen zweimal — das ist
 *  billiger als eine zweite Seite, die meistens leer bleibt. */
const ROWS = 12

const CELL = 'border border-zinc-400 px-2 py-2.5'
const HEAD = 'border border-zinc-400 bg-zinc-100 px-2 py-2 text-left text-xs font-semibold'

/**
 * Der Bogen, der mit an die Linie geht.
 *
 * [Bedienbarkeitsprüfung 2026-09-03, B8] Ein Wertstrom wird nicht am
 * Schreibtisch ausgefuellt, sondern an der Maschine aufgenommen — dort steht
 * kein Telefon in der Hand, sondern ein Blatt auf dem Klemmbrett. Der Editor
 * sagte einem Yellow Belt bisher nicht, welche Zahlen er ueberhaupt erheben
 * muss; dieses Blatt ist die Antwort, und die Spalten sind genau die Felder
 * der Prozessbox.
 *
 * Bewusst oeffentlich und ohne Projektbezug: Der Bogen enthaelt keine Daten,
 * er sammelt sie erst. Wer ihn vor dem ersten Projekt braucht — und das ist
 * die Reihenfolge, in der ein Workshop tatsaechlich ablaeuft — soll ihn nicht
 * hinter einer Anmeldung suchen muessen.
 */
export default async function DataSheetPage() {
  const t = await getTranslations('DataSheet')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        {/* Auf Papier hat weder ein Zurueck-Link noch ein Druckknopf etwas zu
            suchen — beide verschwinden im Druck (print:hidden). */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            {t('back')}
          </Link>
          <PrintButton label={t('print')} />
        </div>

        <div className="mt-4 rounded-surface border border-zinc-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">{t('intro')}</p>

          {/* Kopfzeile: drei Felder auf einer Linie, mit Schreiblinie statt
              Kaestchen — auf Papier schreibt man auf eine Linie. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[t('project'), t('recordedBy'), t('date')].map((label) => (
              <div key={label}>
                <div className="text-xs font-medium text-zinc-600">{label}</div>
                <div className="mt-6 border-b border-zinc-400" />
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold text-zinc-950">{t('frameTitle')}</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            {[t('annualDemand'), t('availableMinutes'), t('pieceValue')].map((label) => (
              <div key={label}>
                <div className="text-xs text-zinc-600">{label}</div>
                <div className="mt-6 border-b border-zinc-400" />
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold text-zinc-950">{t('stationsTitle')}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${HEAD} w-8`}>{t('colNo')}</th>
                  <th className={HEAD}>{t('colProcess')}</th>
                  <th className={HEAD}>{t('colCycleTime')}</th>
                  <th className={HEAD}>{t('colChangeover')}</th>
                  <th className={HEAD}>{t('colOee')}</th>
                  <th className={HEAD}>{t('colOperators')}</th>
                  <th className={HEAD}>{t('colWipAfter')}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => (
                  <tr key={i}>
                    <td className={`${CELL} text-center text-xs tabular-nums text-zinc-500`}>
                      {i + 1}
                    </td>
                    <td className={CELL} />
                    <td className={CELL} />
                    <td className={CELL} />
                    <td className={CELL} />
                    <td className={CELL} />
                    <td className={CELL} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Die Erklaerungen stehen auf demselben Blatt und nicht im Werkzeug:
              Wer an der Maschine steht und sich fragt, ob die Ruestzeit das
              ganze Los meint, hat den Bildschirm nicht dabei. */}
          <h2 className="mt-8 text-sm font-semibold text-zinc-950">{t('howTitle')}</h2>
          <dl className="mt-2 grid gap-2 text-xs leading-relaxed text-zinc-600">
            {[
              t('howCycleTime'),
              t('howChangeover'),
              t('howOee'),
              t('howOperators'),
              t('howWip'),
            ].map((line) => {
              const [term, ...rest] = line.split(': ')
              return (
                <div key={term} className="break-inside-avoid">
                  <dt className="inline font-semibold text-zinc-800">{term}: </dt>
                  <dd className="inline">{rest.join(': ')}</dd>
                </div>
              )
            })}
          </dl>

          {/* Die eigene Adresse steht in NEXT_PUBLIC_SITE_URL — derselben
              Variablen, aus der auch metadataBase und die Einladungslinks
              kommen. Ist sie nicht gesetzt (lokal), bleibt die Zeile ohne
              Adresse, statt eine zu erfinden. */}
          <p className="mt-8 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
            {siteUrl ? t('footerWithUrl', { url: siteUrl }) : t('footer')}
          </p>
        </div>
      </div>
    </div>
  )
}
