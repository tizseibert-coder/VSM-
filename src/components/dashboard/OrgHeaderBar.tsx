import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { SITE_NAME } from '@/lib/seo/site'
import { signOut, switchOrg } from '@/app/[locale]/dashboard/actions'
import type { Membership } from '@/lib/org/pickActiveOrg'
import type { OrgProfile } from '@/lib/org/orgSettings'
import type { Staff } from '@/lib/crm/staff'
import OrgMark from '@/components/org/OrgMark'
import { orgLogoUrl } from '@/lib/org/branding'
import { buttonSecondary } from '@/components/ui/buttons'
import { SubmitButton } from '@/components/ui/SubmitButton'

/**
 * Die Kopfzeile über /projects *und* der Firmenübersicht
 * (docs/plan-company-overview-modules.md) — Firmenlogo/-name, Anmeldename,
 * Organisations-Umschalter, Admin/Kapazität/Firma/Team/Abmelden. Bewusst aus
 * dem Seiteninhalt herausgezogen (bis Schritt 3 stand sie nur in /projects):
 * Genau dieser Block hatte gerade erst einen echten Überlappungs-Bug, als
 * ein vierter Knopf dazukam — zwei Kopien derselben Navigation zu pflegen
 * hätte diese Art Fehler beim nächsten Knopf verdoppelt statt vermieden.
 */
export default async function OrgHeaderBar({
  activeOrg,
  allOrgs,
  profile,
  staff,
  email,
}: {
  activeOrg: Membership | null
  allOrgs: Membership[]
  profile: OrgProfile | null
  staff: Staff | null
  email: string | null
}) {
  const t = await getTranslations('Dashboard')
  const logoUrl = profile?.hasLogo ? orgLogoUrl(profile.organizationId, profile.logoVersion) : null

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {activeOrg && profile && <OrgMark logoUrl={logoUrl} name={profile.displayName} />}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {SITE_NAME}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-zinc-950">{t('title')}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {t('signedInAs', { email: email ?? '' })}
              {activeOrg && (
                <>
                  {' '}
                  · {profile?.displayName ?? activeOrg.organizationName} ({activeOrg.role})
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {staff && (
            <Link href="/admin" className={buttonSecondary}>
              {t('admin')}
            </Link>
          )}
          <Link href="/capacity" className={buttonSecondary}>
            {t('capacity')}
          </Link>
          <Link href="/settings" className={buttonSecondary}>
            {t('settings')}
          </Link>
          <Link href="/team" className={buttonSecondary}>
            {t('team')}
          </Link>
          <form action={signOut}>
            <SubmitButton className={buttonSecondary}>{t('signOut')}</SubmitButton>
          </form>
        </div>
      </div>

      {/* Nur sichtbar, wenn es etwas zu wechseln gibt. Ein Umschalter mit
          genau einem Eintrag waere Ballast — und das ist bis auf Weiteres
          der Normalfall. Ein Formular je Organisation statt eines Selects:
          kein Client-JavaScript noetig, und bei zwei bis drei Firmen ist es
          auch schneller zu bedienen. */}
      {allOrgs.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">{t('organisation')}</span>
          {allOrgs.map((org) => (
            <form key={org.organizationId} action={switchOrg.bind(null, org.organizationId)}>
              <SubmitButton
                aria-current={org.organizationId === activeOrg?.organizationId ? 'true' : undefined}
                className={
                  org.organizationId === activeOrg?.organizationId
                    ? 'rounded-control bg-brand-600 px-3 py-1.5 text-xs font-medium text-white'
                    : 'rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100'
                }
              >
                {org.organizationName}
              </SubmitButton>
            </form>
          ))}
        </div>
      )}
    </>
  )
}
