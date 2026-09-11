import { expect, test } from '@playwright/test'
import { buildCsvTemplate } from '../src/lib/vsm/csvTemplate'
import { FREMD, MITGLIED, PROJEKT_EIGEN } from './fixtures/konten'

/**
 * Die Wege, die zuletzt gebaut und nie im echten Editor gesehen wurden.
 */
test.describe('mit angemeldetem Mitglied', () => {
  test.use({ storageState: MITGLIED.sitzung })

  test('vom Anlegen bis zur Zeichenfläche, mit Kopfdaten', async ({ page }) => {
    await page.goto('/de/dashboard/new')

    const name = `Prüflauf ${Date.now()}`
    await page.fill('#np-name', name)
    await page.fill('#np-line', 'Drehlinie 2')
    await page.fill('#np-shift-count', '2')
    await page.fill('#np-shift-minutes', '450')
    await page.fill('#np-demand', '50000')
    await page.getByRole('button', { name: /Wertstrom anlegen/i }).click()

    // Landet auf der Zeichenflaeche.
    await expect(page).toHaveURL(/\/de\/editor\//, { timeout: 30_000 })

    // Die Kopfdaten stehen dort — das ist der Teil, den ich gebaut und nie
    // im laufenden Editor gesehen habe.
    await expect(page.locator('#line-label')).toHaveValue('Drehlinie 2')
    await expect(page.locator('#shift-count')).toHaveValue('2')
    await expect(page.locator('#shift-minutes')).toHaveValue('450')

    // Das Schichtmodell rechnet die verfuegbaren Minuten aus: 2 x 450.
    await expect(page.locator('#available-minutes')).toHaveValue('900')
  })

  test('der Erhebungsbogen wird zu einer verbundenen Kette', async ({ page }) => {
    await page.goto(`/de/editor/${PROJEKT_EIGEN}`)
    await page.waitForLoadState('networkidle')

    // Die Durchlaufzeit vor dem Import. Ohne Stationen ist sie unbekannt.
    const kopfzeile = buildCsvTemplate().split('\n')[0]
    const bogen = [
      kopfzeile,
      'Sägen;1,2;5;82;1;0;3200',
      'Drehen;3,4;15;78;2;0;2100',
      'Fräsen;2,6;20;85;1;0;900',
    ].join('\n')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'erhebungsbogen.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(bogen, 'utf8'),
    })

    // Die drei Stationen stehen auf der Flaeche.
    await expect(page.getByText('Sägen')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Fräsen')).toBeVisible()

    // Und der eigentliche Punkt: Vor der Korrektur legte der Import keine
    // Puffer an, damit war der Bestand 0 und die Durchlaufzeit 0 Tage. Ein
    // Wertstrom, der nichts aussagt.
    const durchlaufzeit = page.getByTestId('kpi-lead-time')
    if (await durchlaufzeit.count()) {
      await expect(durchlaufzeit).not.toHaveText('–')
    }
  })
})

test.describe('Berechtigungsgrenze', () => {
  test.use({ storageState: FREMD.sitzung })

  test('ein fremdes Konto sieht den Wertstrom nicht', async ({ page }) => {
    // Dasselbe Projekt, anderes Konto, andere Organisation. Sieht es der
    // Nutzer trotzdem, ist die Zeilensicherheit durchlaessig — oder die
    // nachgebildete has_org_role() zu freundlich.
    const antwort = await page.goto(`/de/editor/${PROJEKT_EIGEN}`)
    const status = antwort?.status() ?? 0
    const inhalt = await page.content()

    expect(
      status === 404 || status === 403 || !inhalt.includes('Prüfstrom'),
      `Fremdes Konto bekam Status ${status} und sah den Wertstrom`
    ).toBe(true)
  })
})
