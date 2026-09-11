import { expect, test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ALLE_KONTEN, type Konto } from './fixtures/konten'
import { DASHBOARD } from './fixtures/adressen'

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
  // Mit Sprachpraefix, und das ist die Zusicherung: Die Anmeldung leitet ueber
  // redirectLocalized um, landet also auf /de/dashboard. Ginge sie wieder auf
  // den nackten redirect zurueck, bliebe die Adresse "/dashboard" und dieser
  // Test faellt.
  await expect(page, `Anmeldung von ${konto.email} blieb haengen`).toHaveURL(DASHBOARD, {
    timeout: 30_000,
  })

  mkdirSync(dirname(konto.sitzung), { recursive: true })
  await page.context().storageState({ path: konto.sitzung })
}

for (const konto of ALLE_KONTEN) {
  setup(`anmelden: ${konto.email}`, async ({ page }) => {
    await anmelden(page, konto)
  })
}
