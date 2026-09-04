'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Die Sprachumschaltung, als Fusszeile jeder Seite.
 *
 * Es gibt keinen gemeinsamen Kopfbereich, den alle vierzehn Seiten teilen —
 * jede baut ihre eigene "VSM BUILDER"-Zeile selbst, und fuenf (Anmelden,
 * Registrieren, Bestaetigung, Einladung, Vergleich) haben ueberhaupt keine
 * Kopfzeile. Deshalb steht der Umschalter weiterhin im Root-Layout.
 *
 * [Bedienbarkeitspruefung 2026-09-03, B13] Er schwebte dort bisher fest
 * unten rechts ueber dem Inhalt und stand in mehreren Aufnahmen mitten im
 * Erklaersatz des Austaktungsdiagramms — am Telefon ist die Textspalte so
 * breit wie das Bild, ein schwebendes Element deckt dort immer etwas zu.
 * Jetzt laeuft er im Fluss mit, als schmale Leiste am Seitenende. `mt-auto`
 * im `flex flex-col` des Body haelt ihn auch auf kurzen Seiten unten, ohne
 * dass er etwas verdeckt. Sprachwahl ist eine Handlung pro Besuch; die
 * Fusszeile ist der Ort, an dem man sie erwartet.
 *
 * Die Knoepfe messen jetzt 44 px in der Hoehe statt 24 — dieselbe
 * Mindestflaeche wie ueberall sonst im Werkzeug.
 *
 * Wechselt die Sprache unter Beibehaltung der aktuellen Seite: wer auf
 * `/de/editor/abc` steht und auf "English" klickt, landet auf
 * `/en/editor/abc`, nicht auf der Startseite.
 */
export default function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(nextLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  return (
    <div
      // print:hidden — auf Papier ist die Sprache entschieden, und auf dem
      // Erhebungsbogen stand der Umschalter mitten in der Fusszeile.
      className="mt-auto flex items-center justify-end gap-1 border-t border-zinc-200 bg-white px-4 py-2 text-xs print:hidden"
      aria-label={t('label')}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={isPending}
          onClick={() => handleChange(loc)}
          aria-pressed={locale === loc}
          className={
            locale === loc
              // min-h-11 = 44 px. Die Schrift ist klein, die Flaeche darf es
              // nicht sein; `px-4 py-3` allein ergab bei 12 px Schrift nur 40.
              ? 'inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 font-medium text-white'
              : 'inline-flex min-h-11 items-center rounded-control px-4 font-medium text-zinc-600 hover:bg-zinc-100'
          }
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
