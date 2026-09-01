import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function CheckEmailPage() {
  const t = await getTranslations('CheckEmail')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-surface border border-black/10 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-950">{t('title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('body')}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-zinc-950 underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  )
}
