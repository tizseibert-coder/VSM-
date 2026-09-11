import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createProject } from '../actions'
import CsvTemplateButton from '@/components/dashboard/CsvTemplateButton'
import { buttonPrimaryLg, inputMd } from '@/components/ui/buttons'
import { SUPPORTED_CURRENCIES } from '@/lib/vsm/capital'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { projectDefaults } from '@/lib/org/orgSettings'

/**
 * Der Schritt zwischen "neuer Wertstrom" und der leeren Zeichenflaeche.
 *
 * Ein Wertstrom entstand bisher aus einem einzigen Namensfeld und landete
 * sofort auf der Flaeche. Wer aber eine Aufnahme macht, hat zu diesem Zeitpunkt
 * schon etwas in der Hand: den Erhebungsbogen von der Linie. Diese Seite bildet
 * diesen Ablauf ab — eintragen, was auf dem Bogen steht, den Bogen fuer die
 * Stationen mitnehmen, und erst dann zeichnen.
 *
 * Die Reihenfolge der Felder ist die des Bogens (/data-sheet), damit man von
 * oben nach unten abtippen kann, ohne zu suchen.
 *
 * Server-Component mit <form action={...}>, kein Client-JavaScript ausser dem
 * Download-Knopf — dasselbe Muster wie der Future-State-Wizard.
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const t = await getTranslations('NewProject')

  // Die Waehrung des Firmenprofils vorbelegen. Ohne das schickt die Auswahl
  // immer ihren ersten Eintrag mit und ueberschriebe damit ein Profil, das auf
  // Franken steht — der Unterschied zwischen "einmal einstellen" und "bei jedem
  // Wertstrom wieder waehlen" ist genau das, was orgSettings.ts vermeiden will.
  const orgResult = await getActiveOrg()
  const defaults =
    'error' in orgResult || !orgResult.active
      ? {}
      : await projectDefaults(orgResult.active.organizationId, orgResult.active.organizationName)
  const defaultCurrency = defaults.currency ?? 'EUR'

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
          {t('back')}
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t('intro')}</p>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={createProject} className="mt-8 flex flex-col gap-8">
          <section>
            <h2 className="text-sm font-semibold text-zinc-950">{t('nameHeading')}</h2>
            <div className="mt-3">
              <label htmlFor="np-name" className="block text-xs font-medium text-zinc-600">
                {t('nameLabel')}
              </label>
              <input
                id="np-name"
                name="name"
                required
                autoFocus
                placeholder={t('namePlaceholder')}
                className={`mt-1 w-full ${inputMd}`}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-950">{t('headerHeading')}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t('optionalHint')}</p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="np-line" className="block text-xs font-medium text-zinc-600">
                  {t('lineLabel')}
                </label>
                <input
                  id="np-line"
                  name="lineLabel"
                  placeholder={t('linePlaceholder')}
                  className={`mt-1 w-full ${inputMd}`}
                />
              </div>

              <div>
                <label htmlFor="np-shift-count" className="block text-xs font-medium text-zinc-600">
                  {t('shiftCountLabel')}
                </label>
                <input
                  id="np-shift-count"
                  name="shiftCount"
                  type="number"
                  min={1}
                  placeholder="2"
                  className={`mt-1 w-full ${inputMd}`}
                />
              </div>
              <div>
                <label htmlFor="np-shift-minutes" className="block text-xs font-medium text-zinc-600">
                  {t('shiftMinutesLabel')}
                </label>
                <input
                  id="np-shift-minutes"
                  name="shiftNetMinutes"
                  type="number"
                  min={1}
                  placeholder="450"
                  className={`mt-1 w-full ${inputMd}`}
                />
              </div>

              <div>
                <label htmlFor="np-recorded-on" className="block text-xs font-medium text-zinc-600">
                  {t('recordedOnLabel')}
                </label>
                <input id="np-recorded-on" name="recordedOn" type="date" className={`mt-1 w-full ${inputMd}`} />
              </div>
              <div>
                <label htmlFor="np-recorded-by" className="block text-xs font-medium text-zinc-600">
                  {t('recordedByLabel')}
                </label>
                <input
                  id="np-recorded-by"
                  name="recordedBy"
                  placeholder={t('recordedByPlaceholder')}
                  className={`mt-1 w-full ${inputMd}`}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-950">{t('frameHeading')}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t('frameHint')}</p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="np-demand" className="block text-xs font-medium text-zinc-600">
                  {t('annualDemandLabel')}
                </label>
                <input
                  id="np-demand"
                  name="annualThroughput"
                  type="number"
                  min={0}
                  placeholder="50000"
                  className={`mt-1 w-full ${inputMd}`}
                />
              </div>
              <div>
                <label htmlFor="np-piece-value" className="block text-xs font-medium text-zinc-600">
                  {t('pieceValueLabel')}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="np-piece-value"
                    name="pieceValue"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="50"
                    className={`w-full ${inputMd}`}
                  />
                  <select
                    name="currency"
                    aria-label={t('currencyLabel')}
                    defaultValue={defaultCurrency}
                    className={inputMd}
                  >
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Der Bogen steht *vor* dem Anlegen-Knopf und nicht danach: Wer die
              Stationen noch aufnehmen muss, soll ihn mitnehmen, bevor er auf
              der Zeichenflaeche landet und ihn dort sucht. */}
          <section className="rounded-surface border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">{t('sheetHeading')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{t('sheetBody')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CsvTemplateButton label={t('sheetDownload')} />
              <Link href="/data-sheet" className="text-sm font-medium text-brand-600 hover:underline">
                {t('sheetPrint')}
              </Link>
            </div>
          </section>

          <div>
            <button type="submit" className={buttonPrimaryLg}>
              {t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
