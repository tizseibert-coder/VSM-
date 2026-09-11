import { expect, test } from '@playwright/test'
import { erwarteKeinenUeberlauf } from './fixtures/ueberlauf'
import { WIDTHS } from './pages'
import { BETRIEB, PROJEKT_EIGEN } from './fixtures/konten'

/**
 * Die Seiten hinter der Anmeldung.
 *
 * Warum es diese Datei gibt: Der Layout-Fehler, der die Browsertests
 * ausgeloest hat, sass im Dashboard-Kopf — und war vom anonymen Durchlauf
 * nicht erreichbar. Die Middleware (src/lib/supabase/proxy.ts) leitet ohne
 * Anmeldung auf /login um, der Kopf mit seinen vier Knoepfen erscheint sogar
 * nur fuer ein Konto in `vsm_staff`.
 *
 * Deshalb laeuft dieser Durchlauf mit dem Betriebskonto: Es ist das einzige,
 * bei dem alle vier Knoepfe nebeneinander stehen und die Zeile damit ihre
 * volle Breite braucht.
 */
test.use({ storageState: BETRIEB.sitzung })

const SEITEN = [
  { path: '/de/dashboard', name: 'Dashboard' },
  { path: '/de/dashboard/new', name: 'Anlegeseite' },
  { path: `/de/editor/${PROJEKT_EIGEN}`, name: 'Editor' },
  { path: '/de/settings', name: 'Firma' },
  { path: '/de/team', name: 'Team' },
] as const

for (const { path, name } of SEITEN) {
  for (const width of WIDTHS) {
    test(`${name} bei ${width}px: nichts ragt aus dem Bild`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await erwarteKeinenUeberlauf(page, path)
    })
  }
}

test('der Kopf zeigt dem Betriebskonto alle vier Knöpfe', async ({ page }) => {
  // Die Voraussetzung des Durchlaufs oben, und deshalb eigens geprueft:
  // Faellt die vsm_staff-Zeile weg, steht nur noch ein Knopf weniger im Kopf,
  // die Zeile wird schmaler, und der Ueberlauf-Durchlauf wuerde stillschweigend
  // weniger pruefen als er soll.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/de/dashboard')
  for (const knopf of ['Verwaltung', 'Firma', 'Team', 'Abmelden']) {
    await expect(page.getByRole('link', { name: knopf }).or(page.getByRole('button', { name: knopf }))).toBeVisible()
  }
})
