// Woher jemand kam — die erste Beruehrung, nicht die letzte.
//
// Wer ueber eine LinkedIn-Anzeige auf die Verkaufsseite kommt, sich die Demo
// ansieht, weggeht und drei Tage spaeter ueber die Google-Suche
// zurueckkommt und sich registriert, ist ein Treffer *der Anzeige*. Wuerde
// jeder Besuch die Angaben ueberschreiben, stuende in der Statistik
// "organische Suche" — und die Anzeige saehe aus, als haette sie nichts
// gebracht.
//
// Deshalb: erster Schreiber gewinnt. Das Cookie wird nur gesetzt, wenn noch
// keines da ist.

/** Erstanbieter-Cookie, kein Dienst von aussen und keine Kennung ueber
 *  Webseiten hinweg: Es steht ausschliesslich drin, was in der aufgerufenen
 *  Adresse stand. */
export const ATTRIBUTION_COOKIE = 'vsm_attr'

/** 30 Tage. Ein Beschaffungsvorgang in der Industrie dauert laenger, aber
 *  laenger aufzubewahren waere nicht mehr durch den Zweck gedeckt. */
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type Attribution = {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  referrer?: string
  landingPath?: string
}

/** Laengenbegrenzung je Feld. Ein Kampagnenname mit 4000 Zeichen ist kein
 *  Kampagnenname, sondern ein Versuch, das Cookie oder die Spalte zu
 *  sprengen. */
const MAX_LENGTH = 200

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_LENGTH)
}

/**
 * Liest die Kampagnenangaben aus der aufgerufenen Adresse.
 *
 * `gclid`/`fbclid` und Verwandte bleiben bewusst draussen: Sie sind Kennungen
 * einzelner Klicks bei einem Anzeigenanbieter, nicht die Kampagne — und sie
 * hier abzulegen hiesse, eine fremde Kennung dauerhaft zu speichern.
 */
export function readAttributionFromUrl(url: URL, referrer?: string | null): Attribution | null {
  const params = url.searchParams

  const attribution: Attribution = {
    utmSource: clean(params.get('utm_source')),
    utmMedium: clean(params.get('utm_medium')),
    utmCampaign: clean(params.get('utm_campaign')),
    utmTerm: clean(params.get('utm_term')),
    utmContent: clean(params.get('utm_content')),
    // Der eigene Host als Verweisquelle ist keine Verweisquelle, sondern der
    // Klick von der eigenen Startseite auf die eigene Preisseite.
    referrer: clean(sameHost(referrer, url) ? null : referrer),
    landingPath: url.pathname,
  }

  // Ein Besuch ohne Kampagne und ohne fremde Verweisquelle ist Direktverkehr.
  // Dafuer ein Cookie zu setzen, das nur den Pfad enthaelt, waere ein Cookie
  // ohne Aussage.
  const hasSignal =
    attribution.utmSource ||
    attribution.utmMedium ||
    attribution.utmCampaign ||
    attribution.utmTerm ||
    attribution.utmContent ||
    attribution.referrer

  return hasSignal ? attribution : null
}

function sameHost(referrer: string | null | undefined, url: URL): boolean {
  if (!referrer) return false
  try {
    return new URL(referrer).host === url.host
  } catch {
    return false
  }
}

/** Fuer das Cookie. Leere Felder fliegen raus, damit der Wert kurz bleibt. */
export function serializeAttribution(attribution: Attribution): string {
  const compact = Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => value !== undefined && value !== '')
  )
  return JSON.stringify(compact)
}

/**
 * Aus dem Cookie zurueck.
 *
 * Ungueltiges JSON ergibt `null` statt eines Fehlers: Der Wert kommt aus dem
 * Browser des Besuchers und kann alles sein. Eine kaputte Attribution darf
 * hoechstens die Statistik kosten, nicht die Registrierung.
 */
export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    const pick = (key: string) =>
      typeof record[key] === 'string' ? clean(record[key] as string) : undefined

    const attribution: Attribution = {
      utmSource: pick('utmSource'),
      utmMedium: pick('utmMedium'),
      utmCampaign: pick('utmCampaign'),
      utmTerm: pick('utmTerm'),
      utmContent: pick('utmContent'),
      referrer: pick('referrer'),
      landingPath: pick('landingPath'),
    }

    return Object.values(attribution).some((value) => value !== undefined) ? attribution : null
  } catch {
    return null
  }
}

/** Die Spaltennamen von `vsm_leads`. Die Umbenennung an genau einer Stelle,
 *  damit nicht jede Schreibstelle ihre eigene Zuordnung erfindet. */
export function attributionColumns(attribution: Attribution | null) {
  return {
    utm_source: attribution?.utmSource ?? null,
    utm_medium: attribution?.utmMedium ?? null,
    utm_campaign: attribution?.utmCampaign ?? null,
    utm_term: attribution?.utmTerm ?? null,
    utm_content: attribution?.utmContent ?? null,
    referrer: attribution?.referrer ?? null,
    landing_path: attribution?.landingPath ?? null,
  }
}
