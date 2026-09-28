import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * Kopf beider Social-Seiten: Reiter und die Rueckmeldung der letzten
 * Handlung. Die Rueckmeldung kommt als Suchparameter, weil die Server
 * Actions mit `redirect()` enden — derselbe Weg wie bei den Interessenten.
 *
 * `msg` ist Text aus einer Fehlermeldung (Plattform-API, Claude). React
 * maskiert ihn beim Ausgeben; er wird nur angezeigt, nie ausgewertet.
 */
export async function SocialHeader({
  active,
  notice,
  error,
  msg,
}: {
  active: 'overview' | 'queue'
  notice?: string
  error?: string
  msg?: string
}) {
  const t = await getTranslations('Social')

  const tab = (key: 'overview' | 'queue', href: string) => (
    <Link
      href={href}
      className={`border-b-2 px-1 pb-2 text-sm ${
        active === key
          ? 'border-brand-600 font-medium text-zinc-950'
          : 'border-transparent text-zinc-600 hover:text-brand-600'
      }`}
    >
      {t(key === 'overview' ? 'tabOverview' : 'tabQueue')}
    </Link>
  )

  const knownNotices = ['saved', 'approve', 'reject', 'reopen', 'published', 'metrics', 'generated', 'analyzed', 'fetched', 'nothing']
  const knownErrors = ['invalid', 'save', 'publish', 'notConfigured', 'needVisibility', 'generate', 'analyze', 'metrics']

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-600">{t('intro')}</p>

      <nav className="mt-5 flex gap-6 border-b border-zinc-200">
        {tab('overview', '/admin/social')}
        {tab('queue', '/admin/social/queue')}
      </nav>

      {notice && knownNotices.includes(notice) && (
        <p className="mt-4 rounded-control bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {t(`notice_${notice}`, { msg: msg ?? '' })}
        </p>
      )}
      {error && knownErrors.includes(error) && (
        <p className="mt-4 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(`error_${error}`)}
          {msg ? <span className="mt-1 block break-words font-mono text-xs">{msg}</span> : null}
        </p>
      )}
    </div>
  )
}
