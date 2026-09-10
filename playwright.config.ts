import { defineConfig, devices } from '@playwright/test'

/**
 * Browsertests fuer die oeffentlichen Seiten.
 *
 * Warum es sie gibt: Zwei Fehlerklassen dieser Anwendung findet kein
 * Unit-Test. Ob ein Kasten aus dem Bild laeuft, steht in keiner reinen
 * Funktion — es entsteht erst aus Schriftgroesse, Polsterung und
 * Bildschirmbreite zusammen. Beide Layout-Fehler, die zuletzt behoben wurden
 * (Dashboard-Kopf, Loeschen-Knopf), fielen erst an einem echten Telefon auf.
 *
 * `webServer` baut und startet die Anwendung selbst, damit ein Lauf keine
 * Vorbereitung braucht. Die Supabase-Platzhalter genuegen: Nachgemessen
 * antworten alle oeffentlichen Seiten damit mit 200, und /dashboard leitet
 * wie vorgesehen auf /login um — die Middleware ruft zwar bei jeder Anfrage
 * getClaims(), kommt ohne Session-Cookie aber ohne Netzzugriff aus.
 */
const PORT = 3123

export default defineConfig({
  testDir: './e2e',
  // Ein Fehlschlag soll erklaerbar sein, nicht weggewiederholt werden.
  retries: 0,
  fullyParallel: true,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // In CI installiert `playwright install chromium` den Browser, der zur
        // gepinnten Fassung passt, und dieser Zweig bleibt leer. In einer
        // Umgebung mit vorinstalliertem Chromium (etwa dieser Sandbox) kann
        // dessen Build von dem abweichen, den Playwright erwartet — dann zeigt
        // PLAYWRIGHT_CHROMIUM_EXECUTABLE auf die vorhandene Binaerdatei, statt
        // einen Download anzustossen, den die Umgebung ohnehin unterbindet.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/de`,
    // Bewusst *nie* wiederverwenden, auch lokal nicht: Ein Server aus einem
    // frueheren Lauf traegt dessen Build, und der Lauf prueft dann
    // stillschweigend Code, den niemand mehr hat. Genau das ist beim
    // Einrichten dieser Tests mehrfach passiert und hat drei Fehlalarme und
    // eine halbe Stunde gekostet. Ein Neubau je Lauf kostet zwanzig Sekunden.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_platzhalter',
      SUPABASE_SERVICE_ROLE_KEY: 'platzhalter',
      VSM_PLAN_ENFORCEMENT: 'off',
    },
  },
})
