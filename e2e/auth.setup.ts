import { expect, test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ALLE_KONTEN, type Konto } from './fixtures/konten'

/**
 * Meldet jedes Testkonto an und legt den Sitzungsstand ab.
 *
 * Durch das *echte* Anmeldeformular und nicht mit einem selbst gebauten
 * Token: Der Anmeldeweg gehoert zu den Dingen, die brechen koennen, und ein
 * Test, der ihn umgeht, merkt es nicht. Ein Durchlauf je Konto, danach
 * starten alle uebrigen Tests mit dem gespeicherten Stand — anmelden ist
 * langsam, und dreissig Mal anmelden waere dreissig Mal langsam.
 */
async function anmelden(page: import('@playwright/test').Page, konto: Konto) {
  await page.goto('/de/login')
  await page.fill('#email', konto.email)
  await page.fill('#password', konto.passwort)
  await page.click('button[formaction], button[type="submit"]')

  // Die Anmeldung fuehrt auf das Dashboard. Bleibt sie auf /login, stimmt
  // etwas mit den Konten nicht, und das soll hier auffallen und nicht erst
  // im naechsten Test als raetselhafte leere Seite.
  //
  // Das Sprachpraefix ist hier bewusst freigestellt, und das ist keine
  // Bequemlichkeit: login/actions.ts leitet mit dem nackten `redirect` aus
  // next/navigation um, landet also auf "/dashboard" statt "/de/dashboard" —
  // obwohl routing.ts `localePrefix: 'always'` setzt. Der Kommentar in
  // src/i18n/navigation.ts kennt diese Schuld und nimmt an, die Middleware
  // fange den fehlenden Praefix mit einem zusaetzlichen Sprung ab. Im Lauf
  // gemessen tut sie das nicht: Die Adresse bleibt ueber sechzig Abfragen
  // hinweg "/dashboard". Elf Action-Dateien haengen daran; das ist ein
  // eigener Umbau und nicht Aufgabe dieses Testaufbaus.
  await expect(page, `Anmeldung von ${konto.email} blieb haengen`).toHaveURL(
    /\/(de\/)?dashboard/,
    { timeout: 30_000 }
  )

  mkdirSync(dirname(konto.sitzung), { recursive: true })
  await page.context().storageState({ path: konto.sitzung })
}

for (const konto of ALLE_KONTEN) {
  setup(`anmelden: ${konto.email}`, async ({ page }) => {
    await anmelden(page, konto)
  })
}
