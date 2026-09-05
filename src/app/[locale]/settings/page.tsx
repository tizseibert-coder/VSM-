import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { loadOrgProfile } from '@/lib/org/orgSettings'
import { DEFAULT_BRAND_COLOR, orgLogoUrl } from '@/lib/org/branding'
import { SUPPORTED_CURRENCIES } from '@/lib/vsm/capital'
import { routing } from '@/i18n/routing'
import LogoPicker from '@/components/settings/LogoPicker'
import { buttonPrimary, buttonSecondary, inputMd } from '@/components/ui/buttons'
import { saveOrgProfile } from './actions'

// Das Firmenprofil ist der Aussenauftritt *einer* Firma innerhalb der
// Anwendung, keine oeffentliche Seite. Wie /admin: nicht indexieren.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const FIELD_LABEL = 'text-xs font-medium text-zinc-700'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { error, saved } = await searchParams
  const t = await getTranslations('Settings')
  const tNav = await getTranslations('Nav')

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
            {tNav('backToDashboard')}
          </Link>
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
            {orgResult.error}
          </p>
        </div>
      </div>
    )
  }

  const { active } = orgResult
  const isOwner = active.role === 'owner'
  const profile = await loadOrgProfile(active.organizationId, active.organizationName)
  const logoUrl = profile.hasLogo ? orgLogoUrl(profile.organizationId, profile.logoVersion) : null

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:underline">
          {tNav('backToDashboard')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t('intro', { org: active.organizationName })}</p>

        {error && (
          <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {saved && !error && (
          <p className="mt-4 rounded-control bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {t('saved')}
          </p>
        )}

        {!isOwner && (
          <p className="mt-6 rounded-surface border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            {t('ownersOnly')}
          </p>
        )}

        {/* `fieldset disabled` statt einer zweiten, schreibgeschuetzten
            Ansicht: Ein Mitglied ohne Inhaberrolle soll sehen, was hinterlegt
            ist — auf dem Blatt, das es exportiert, steht es ja. Es soll es
            nur nicht aendern koennen. */}
        <form action={saveOrgProfile} className="mt-8">
          <fieldset disabled={!isOwner} className="space-y-10 disabled:opacity-70">
            <section>
              <h2 className="text-base font-semibold text-zinc-950">{t('sectionIdentity')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('sectionIdentityBody')}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('displayName')}</span>
                  <input
                    name="display_name"
                    defaultValue={profile.displayNameRaw ?? ''}
                    placeholder={active.organizationName}
                    maxLength={120}
                    className={inputMd}
                  />
                  <span className="text-xs text-zinc-500">{t('displayNameHint')}</span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('legalName')}</span>
                  <input
                    name="legal_name"
                    defaultValue={profile.legalName ?? ''}
                    maxLength={160}
                    className={inputMd}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('industry')}</span>
                  <input
                    name="industry"
                    defaultValue={profile.industry ?? ''}
                    placeholder={t('industryPlaceholder')}
                    maxLength={120}
                    className={inputMd}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('website')}</span>
                  <input
                    name="website"
                    defaultValue={profile.website ?? ''}
                    placeholder="www.beispiel.de"
                    maxLength={200}
                    className={inputMd}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('contactEmail')}</span>
                  <input
                    name="contact_email"
                    type="email"
                    defaultValue={profile.contactEmail ?? ''}
                    maxLength={200}
                    className={inputMd}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('contactPhone')}</span>
                  <input
                    name="contact_phone"
                    defaultValue={profile.contactPhone ?? ''}
                    maxLength={60}
                    className={inputMd}
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-950">{t('sectionBrand')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('sectionBrandBody')}</p>

              <div className="mt-4">
                <LogoPicker currentLogoUrl={logoUrl} displayName={profile.displayName} />
              </div>

              <label className="mt-6 flex max-w-xs flex-col gap-1">
                <span className={FIELD_LABEL}>{t('brandColor')}</span>
                <span className="flex items-center gap-2">
                  <input
                    name="brand_color"
                    type="color"
                    defaultValue={profile.brandColor ?? DEFAULT_BRAND_COLOR}
                    className="h-9 w-14 cursor-pointer rounded-control border border-zinc-300 bg-white p-1"
                  />
                  <span className="text-xs text-zinc-500">{t('brandColorHint')}</span>
                </span>
              </label>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-950">{t('sectionDefaults')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('sectionDefaultsBody')}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('defaultCurrency')}</span>
                  <select
                    name="default_currency"
                    defaultValue={profile.defaultCurrency ?? ''}
                    className={inputMd}
                  >
                    <option value="">{t('noDefault')}</option>
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('defaultMinutes')}</span>
                  <input
                    name="default_available_minutes"
                    inputMode="decimal"
                    defaultValue={profile.defaultAvailableMinutes ?? ''}
                    placeholder="480"
                    className={inputMd}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>{t('defaultLocale')}</span>
                  <select
                    name="default_locale"
                    defaultValue={profile.defaultLocale ?? ''}
                    className={inputMd}
                  >
                    <option value="">{t('noDefault')}</option>
                    {routing.locales.map((code) => (
                      <option key={code} value={code}>
                        {t(`locale_${code}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex flex-col gap-1">
                <span className={FIELD_LABEL}>{t('reportFooter')}</span>
                <input
                  name="report_footer"
                  defaultValue={profile.reportFooter ?? ''}
                  placeholder={t('reportFooterPlaceholder')}
                  maxLength={200}
                  className={inputMd}
                />
                <span className="text-xs text-zinc-500">{t('reportFooterHint')}</span>
              </label>
            </section>

            {isOwner && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={buttonPrimary}>
                  {t('save')}
                </button>
                <Link href="/team" className={buttonSecondary}>
                  {t('toTeam')}
                </Link>
              </div>
            )}
          </fieldset>
        </form>
      </div>
    </div>
  )
}
