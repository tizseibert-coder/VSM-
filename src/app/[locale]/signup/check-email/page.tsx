import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-surface border border-black/10 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-950">
          Fast geschafft
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Wir haben dir einen Bestätigungslink per E-Mail geschickt. Klicke darauf, um dein
          Konto zu aktivieren und dich anzumelden.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-zinc-950 underline"
        >
          Zurück zur Anmeldung
        </Link>
      </div>
    </div>
  )
}
