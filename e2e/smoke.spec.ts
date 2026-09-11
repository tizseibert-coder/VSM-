import { expect, test } from '@playwright/test'
import { PUBLIC_PAGES } from './pages'

/**
 * Die Seiten antworten ueberhaupt.
 *
 * Klingt banal und ist es nicht: Eine Server-Component, die beim Rendern
 * wirft, faellt in keinem Unit-Test auf — sie hat keine, weil sie nichts
 * zurueckgibt, was sich isoliert pruefen liesse. Ein 500 auf der Startseite
 * waere bis hierher erst dem Nutzer aufgefallen.
 */
for (const { path, name } of PUBLIC_PAGES) {
  test(`${name} antwortet und zeigt eine Ueberschrift`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status(), `HTTP-Antwort von ${path}`).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
  })
}

test('geschuetzte Seiten fuehren zur Anmeldung statt ins Leere', async ({ page }) => {
  // Die Weiche in src/lib/supabase/proxy.ts. Bricht sie, stehen die
  // Projektdaten offen — das ist der Test, der das merkt.
  await page.goto('/de/dashboard')
  await expect(page).toHaveURL(/\/de\/login/)
})

test('die Demo zeichnet einen Wertstrom', async ({ page }) => {
  await page.goto('/de/demo')
  await page.waitForLoadState('networkidle')
  // Konva zeichnet auf ein <canvas>. Ist es da, hat der Editor gerendert,
  // ohne zu werfen — der groesste Brocken Clientcode dieser Anwendung.
  await expect(page.locator('canvas').first()).toBeVisible()
})
