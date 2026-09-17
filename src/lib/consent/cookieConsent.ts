// Die Einwilligung für nicht notwendige Cookies — bisher gab es genau ein
// Cookie, das das betrifft: `vsm_attr` (siehe lib/crm/attribution.ts), das
// Supabase-Sitzungscookie und das Sprachcookie von next-intl sind technisch
// notwendig und brauchen keine Einwilligung.
//
// Dieses Cookie selbst ist Erstanbieter und nicht-httpOnly: Der Banner
// (Client-Komponente) muss die Entscheidung setzen können, und die Middleware
// (proxy.ts) muss sie beim nächsten Aufruf lesen können, bevor sie `vsm_attr`
// schreibt — kein Analyse-Skript liest es mit.

export const COOKIE_CONSENT_COOKIE = 'vsm_consent'

/** 180 Tage. Lang genug, dass der Banner nicht bei jedem Besuch neu aufpoppt,
 *  kurz genug, dass eine vor Monaten getroffene Entscheidung nicht auf
 *  unbestimmte Zeit fortgilt. */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

export type CookieConsentValue = 'accepted' | 'rejected'

export function isCookieConsentValue(value: string | undefined | null): value is CookieConsentValue {
  return value === 'accepted' || value === 'rejected'
}
