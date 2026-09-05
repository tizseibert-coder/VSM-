'use server'

import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/lib/org/activeOrg'
import {
  MAX_LOGO_BYTES,
  checkLogo,
  normalizeBrandColor,
  sniffImageMime,
} from '@/lib/org/branding'
import { isSupportedCurrency } from '@/lib/vsm/capital'
import { routing } from '@/i18n/routing'
import type { TablesInsert } from '@/types/database'

/** Leeres Feld heisst „nicht gesetzt", nicht „leerer Text". Sonst
 *  unterscheidet die Datenbank zwischen einem nie ausgefuellten und einem
 *  wieder geleerten Feld, und die Oberflaeche kann es nicht. */
function textOrNull(formData: FormData, key: string, maxLength: number): string | null {
  const raw = formData.get(key)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, maxLength)
}

/**
 * Speichert das Firmenprofil.
 *
 * Ein einziges Formular fuer Angaben *und* Logo, obwohl das Bild einen
 * anderen Weg nimmt als ein Textfeld: Wer sein Profil einrichtet, macht das
 * in einem Zug, und zwei Speichern-Knoepfe auf einer Seite lassen ihn
 * ueberlegen, welcher was tut.
 *
 * Absicherung ist die Policy „owners can write org settings". Die Pruefung
 * hier ist die Erklaerung — ohne sie bekaeme ein `editor` eine leere Absage
 * von PostgREST statt eines Satzes, der sagt, warum.
 */
export async function saveOrgProfile(formData: FormData) {
  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirect('/settings?error=' + encodeURIComponent(orgResult.error))
  }
  if (orgResult.active.role !== 'owner') {
    redirect('/settings?error=' + encodeURIComponent(await tErr('settingsOwnersOnly')))
  }

  const organizationId = orgResult.active.organizationId

  const brandColorRaw = formData.get('brand_color')
  const brandColor = normalizeBrandColor(typeof brandColorRaw === 'string' ? brandColorRaw : null)

  const currencyRaw = textOrNull(formData, 'default_currency', 8)
  if (currencyRaw !== null && !isSupportedCurrency(currencyRaw)) {
    redirect('/settings?error=' + encodeURIComponent(await tErr('currencyUnsupported')))
  }

  const localeRaw = textOrNull(formData, 'default_locale', 8)
  const defaultLocale =
    localeRaw !== null && (routing.locales as readonly string[]).includes(localeRaw)
      ? localeRaw
      : null

  // Leer, ungueltig oder ausserhalb 1…1440 heisst „keine Vorgabe" statt einer
  // Fehlermeldung: Das Feld ist eine Bequemlichkeit, kein Pflichtwert, und
  // die Tabelle `projects` hat ihre eigene Vorgabe.
  const minutesRaw = textOrNull(formData, 'default_available_minutes', 8)
  const minutesParsed = minutesRaw === null ? NaN : Number(minutesRaw.replace(',', '.'))
  const defaultMinutes =
    Number.isFinite(minutesParsed) && minutesParsed > 0 && minutesParsed <= 1440
      ? minutesParsed
      : null

  const update: TablesInsert<'vsm_org_settings'> = {
    organization_id: organizationId,
    display_name: textOrNull(formData, 'display_name', 120),
    legal_name: textOrNull(formData, 'legal_name', 160),
    industry: textOrNull(formData, 'industry', 120),
    website: textOrNull(formData, 'website', 200),
    contact_email: textOrNull(formData, 'contact_email', 200),
    contact_phone: textOrNull(formData, 'contact_phone', 60),
    brand_color: brandColor,
    default_currency: currencyRaw,
    default_available_minutes: defaultMinutes,
    default_locale: defaultLocale,
    report_footer: textOrNull(formData, 'report_footer', 200),
  }

  // Das Logo hat drei Zustaende, nicht zwei: neu hochgeladen, entfernt, oder
  // unveraendert. Ein Formular ohne Datei ist der dritte Fall — die Spalten
  // dann auf null zu setzen hiesse, dass jede Aenderung am Telefonnummernfeld
  // das Logo mit loescht.
  const file = formData.get('logo')
  const removeLogo = formData.get('remove_logo') === '1'

  if (removeLogo) {
    update.logo_mime = null
    update.logo_data = null
    update.logo_file_name = null
    update.logo_updated_at = null
  } else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) {
      redirect('/settings?error=' + encodeURIComponent(await tErr('logoTooLarge')))
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    // Nicht `file.type`: Der kommt aus der Dateiendung und ist eine Behauptung.
    // Was gespeichert wird, ist der Typ, den die ersten Bytes belegen.
    const sniffed = sniffImageMime(bytes)
    const base64 = Buffer.from(bytes).toString('base64')
    const verdict = checkLogo(sniffed ?? '', base64)
    if (!verdict.ok) {
      const key =
        verdict.reason === 'size'
          ? 'logoTooLarge'
          : verdict.reason === 'type'
            ? 'logoType'
            : 'logoEmpty'
      redirect('/settings?error=' + encodeURIComponent(await tErr(key)))
    }
    update.logo_mime = sniffed
    update.logo_data = base64
    update.logo_file_name = file.name.slice(0, 120)
    update.logo_updated_at = new Date().toISOString()
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vsm_org_settings')
    .upsert(update, { onConflict: 'organization_id' })

  if (error) {
    console.error('saveOrgProfile failed:', error.message)
    redirect('/settings?error=' + encodeURIComponent(await tErr('settingsSave')))
  }

  // Die Kopfleiste des Dashboards und das Blatt im Editor zeigen beide das
  // Profil; wer es aendert, soll die Aenderung nicht erst nach dem naechsten
  // harten Neuladen sehen.
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  redirect('/settings?saved=1')
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
