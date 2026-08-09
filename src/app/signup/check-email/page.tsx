import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Fast geschafft
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Wir haben dir einen Bestätigungslink per E-Mail geschickt. Klicke darauf, um dein
          Konto zu aktivieren und dich anzumelden.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
        >
          Zurück zur Anmeldung
        </Link>
      </div>
    </div>
  )
}
