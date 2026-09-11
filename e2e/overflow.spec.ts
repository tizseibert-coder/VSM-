import { test } from '@playwright/test'
import { erwarteKeinenUeberlauf } from './fixtures/ueberlauf'
import { PUBLIC_PAGES, WIDTHS } from './pages'

for (const { path, name } of PUBLIC_PAGES) {
  for (const width of WIDTHS) {
    test(`${name} bei ${width}px: nichts ragt aus dem Bild`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      // Die Zeichenflaeche der Demo baut sich erst im Browser auf.
      await page.waitForLoadState('networkidle')
      await erwarteKeinenUeberlauf(page, path)
    })
  }
}
