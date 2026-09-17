'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  isCookieConsentValue,
  type CookieConsentValue,
} from '@/lib/consent/cookieConsent'
import { buttonPrimarySm, buttonSecondarySm } from '@/components/ui/buttons'

/**
 * Der Einwilligungsbanner für `vsm_attr` (lib/crm/attribution.ts) — das
 * einzige Cookie im Werkzeug, das nicht technisch notwendig ist. Die
 * Supabase-Sitzung und die Sprachwahl brauchen keine Einwilligung und
 * stehen deshalb nicht zur Wahl; ein Banner mit einer Kategorie, die man
 * ohnehin nicht abschalten kann, ist keine echte Wahl.
 *
 * Liest die Entscheidung aus `document.cookie` statt aus `localStorage`:
 * Dieselbe Entscheidung muss auch die Middleware (proxy.ts) lesen koennen,
 * bevor sie `vsm_attr` setzt — ein `localStorage`-Wert ist vom Server aus
 * unsichtbar.
 *
 * `useSyncExternalStore` statt eines Effekts, der beim Einhaengen `setState`
 * ruft (derselbe Aufbau wie DemoImportBanner.tsx): Das Cookie ist Aussenwelt,
 * die Server-Momentaufnahme ist `undefined` ("noch nicht entschieden") — ein
 * Banner im Server-HTML ist deshalb kein Hydrationsfehler, sondern genau der
 * richtige Standardfall fuer jemanden, dessen Entscheidung der Server nicht
 * kennt.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('CookieConsent')
  const consent = useSyncExternalStore(subscribeConsent, readConsentCookie, () => undefined)

  if (isCookieConsentValue(consent)) return null

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white px-4 py-4 shadow-[0_-1px_8px_rgba(0,0,0,0.08)] print:hidden"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 flex-1 text-sm text-zinc-600">
          {t('body')}{' '}
          <Link href="/datenschutz" className="font-medium text-brand-600 hover:underline">
            {t('learnMore')}
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => writeConsentCookie('rejected')}
            className={buttonSecondarySm}
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => writeConsentCookie('accepted')}
            className={buttonPrimarySm}
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Reine Weiterleitungen an document.cookie brauchen kein "echtes" Abo — die
// einzige Quelle einer Aenderung ist der eigene Schreibaufruf unten, der die
// Listener direkt anstoesst.
let listeners: (() => void)[] = []

function subscribeConsent(listener: () => void): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function readConsentCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_CONSENT_COOKIE}=`))
    ?.split('=')[1]
}

function writeConsentCookie(value: CookieConsentValue) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  listeners.forEach((listener) => listener())
}
