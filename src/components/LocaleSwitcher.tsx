'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Unauffaellige, immer sichtbare Umschaltung — Platzhalter fuer Phase 0.
 *
 * Es gibt noch keinen gemeinsamen Kopfbereich, den alle Seiten teilen (jede
 * Seite baut ihre eigene "VSM BUILDER"-Zeile selbst, siehe die einzelnen
 * page.tsx-Dateien) — deshalb sitzt der Umschalter hier im Root-Layout als
 * schwebendes Element, statt in einen Header integriert zu sein. Sobald
 * eine Seite fuer die eigentliche Uebersetzung angefasst wird (Phase 1+),
 * wandert er dort an eine passendere Stelle in deren Kopfzeile.
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
      className="fixed bottom-3 right-3 z-40 flex items-center gap-1 rounded-control border border-zinc-200 bg-white/95 p-1 text-xs shadow-sm backdrop-blur"
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
              ? 'rounded-control bg-brand-600 px-2 py-1 font-medium text-white'
              : 'rounded-control px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100'
          }
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
