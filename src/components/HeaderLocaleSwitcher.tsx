'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Kompakte Sprachumschaltung fuer die Kopfzeile der oeffentlichen
 * Einstiegsseiten (Start, Demo, Preise).
 *
 * [Marketing-Audit 2026-09-07, C2] Die Fusszeilen-Umschaltung (siehe
 * LocaleSwitcher.tsx) loest B13 — sie verdeckt nichts mehr —, aber nicht C2:
 * Auf einer langen Seite wie der Startseite liegt die Fusszeile weit unter
 * der Stelle, an der ein Interessent ueberhaupt erst entscheidet, ob er
 * bleibt. Bis dahin ist von der englischen Fassung nichts zu sehen. Genau
 * diese drei Seiten sind der erste Kontakt vor der Anmeldung — alle anderen
 * (Editor, Dashboard, Team, ...) behalten die Fusszeile als einzigen
 * Umschalter, aus demselben Grund wie dort beschrieben: kein gemeinsamer
 * Kopfbereich, und fuenf Seiten haben ueberhaupt keinen.
 *
 * Eine zweite, kleinere Komponente statt eines Groessen-Parameters an
 * LocaleSwitcher: Die Fusszeile misst ihre Knoepfe mit 44 px (Werkstatt-
 * Fingerziel auf einer Seite ohne sonstige Bedienelemente daneben), hier
 * reicht die uebliche Kopfzeilenhoehe, dieselbe wie die Nav-Links direkt
 * daneben.
 */
export default function HeaderLocaleSwitcher() {
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
    <div className="flex items-center gap-0.5 text-xs" aria-label={t('label')}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={isPending}
          onClick={() => handleChange(loc)}
          aria-pressed={locale === loc}
          className={
            locale === loc
              ? 'rounded-control bg-brand-50 px-2.5 py-2 font-medium text-brand-700'
              : 'rounded-control px-2.5 py-2 font-medium text-zinc-500 hover:bg-zinc-100'
          }
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
