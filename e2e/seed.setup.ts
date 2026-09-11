/**
 * Legt die Testkonten und ihre Organisationen in der lokalen Instanz an.
 *
 * Laeuft einmal vor den Browsertests, ueber die Admin-Schnittstelle von
 * GoTrue und danach per Service-Role in die Tabellen. Bewusst *nicht* ueber
 * das Registrierungsformular: Produktiv legt `handle_new_user()` von Prisma
 * die Organisation an, und diesen Trigger gibt es lokal nicht. Ihn
 * nachzubilden waere ein zweiter Trigger auf `auth.users` — genau die
 * Konstellation, die supabase/README.md als Ursache des Ausfalls vom 16.08.
 * beschreibt. Die Zeilen direkt zu setzen umgeht die Frage ganz.
 *
 * Laeuft als Playwright-Vorprojekt `saeen`, vor `anmelden`: So braucht es
 * keinen zweiten TypeScript-Laeufer, und die Reihenfolge steht in der
 * Konfiguration statt verstreut im Workflow.
 */
import { test as setup } from '@playwright/test'
import { ALLE_KONTEN, BETRIEB, FREMD, LOKAL, MITGLIED, ORG_EIGEN, ORG_FREMD, PROJEKT_EIGEN } from './fixtures/konten'

const kopf = {
  apikey: LOKAL.serviceRole,
  Authorization: `Bearer ${LOKAL.serviceRole}`,
  'Content-Type': 'application/json',
}

async function anlegenOderHolen(email: string, passwort: string): Promise<string> {
  const antwort = await fetch(`${LOKAL.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: kopf,
    body: JSON.stringify({ email, password: passwort, email_confirm: true }),
  })

  if (antwort.ok) return ((await antwort.json()) as { id: string }).id

  // Schon da (der Workflow faehrt das Skript bei einem erneuten Versuch noch
  // einmal): ueber die Liste nachschlagen statt zu scheitern.
  const liste = await fetch(`${LOKAL.url}/auth/v1/admin/users?per_page=200`, { headers: kopf })
  if (!liste.ok) throw new Error(`Nutzerliste nicht lesbar: ${liste.status} ${await liste.text()}`)
  const { users } = (await liste.json()) as { users: { id: string; email: string }[] }
  const treffer = users.find((u) => u.email === email)
  if (!treffer) throw new Error(`Konto ${email} liess sich weder anlegen noch finden`)
  return treffer.id
}

async function schreiben(tabelle: string, zeilen: unknown[]): Promise<void> {
  const antwort = await fetch(`${LOKAL.url}/rest/v1/${tabelle}`, {
    method: 'POST',
    headers: { ...kopf, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(zeilen),
  })
  if (!antwort.ok) {
    throw new Error(`${tabelle}: ${antwort.status} ${await antwort.text()}`)
  }
}

setup('Testkonten und Organisationen anlegen', async () => {
  if (!LOKAL.serviceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt — ohne ihn laesst sich nichts anlegen.')
  }

  const ids = new Map<string, string>()
  for (const konto of ALLE_KONTEN) {
    ids.set(konto.email, await anlegenOderHolen(konto.email, konto.passwort))
  }

  await schreiben('organizations', [
    { id: ORG_EIGEN, name: 'Musterwerk GmbH' },
    { id: ORG_FREMD, name: 'Fremdwerk AG' },
  ])

  // `admin` fuer die beiden eigenen Konten: Das Dashboard zeigt den
  // Abo-Verwalten-Knopf nur dem Inhaber, und die Anlegeseite braucht
  // Schreibrechte.
  await schreiben('organization_members', [
    { organization_id: ORG_EIGEN, user_id: ids.get(MITGLIED.email), role: 'admin' },
    { organization_id: ORG_EIGEN, user_id: ids.get(BETRIEB.email), role: 'admin' },
    { organization_id: ORG_FREMD, user_id: ids.get(FREMD.email), role: 'admin' },
  ])

  // Erst diese Zeile bringt den vierten Knopf in den Dashboard-Kopf — und
  // damit den Layout-Fehler in Reichweite, wegen dem es diese Tests gibt.
  await schreiben('vsm_staff', [
    { user_id: ids.get(BETRIEB.email), role: 'admin', note: 'Browsertests' },
  ])

  // Ein Wertstrom mit fester Kennung, damit die Berechtigungsgrenze eine
  // Adresse hat, die sie aufrufen kann.
  await schreiben('projects', [
    { id: PROJEKT_EIGEN, organization_id: ORG_EIGEN, name: 'Prüfstrom' },
  ])

  console.log('Testkonten stehen:', [...ids.keys()].join(', '))
})
