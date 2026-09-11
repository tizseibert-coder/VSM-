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

/**
 * In CI installiert `playwright install chromium` die Fassung, die zur
 * gepinnten Version passt, und dieser Zweig bleibt leer. In einer Umgebung mit
 * vorinstalliertem Chromium (etwa der Entwicklungssandbox) kann dessen Build
 * abweichen — dann zeigt PLAYWRIGHT_CHROMIUM_EXECUTABLE auf die vorhandene
 * Binaerdatei, statt einen Download anzustossen, den die Umgebung unterbindet.
 */
const browserPfad = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
  : {}

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
    // Die oeffentlichen Seiten brauchen keine Anmeldung und sollen deshalb
    // auch nicht darauf warten.
    {
      name: 'oeffentlich',
      testMatch: /(overflow|smoke)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...browserPfad },
    },
    // Meldet die Testkonten an und legt ihren Sitzungsstand ab. Laeuft nur,
    // wenn eine lokale Supabase-Instanz da ist — deshalb ein eigenes Projekt
    // und keine globale Vorbereitung: Ohne Instanz laesst sich `--project`
    // schlicht weglassen, und die oeffentlichen Tests laufen weiter.
    {
      name: 'saeen',
      testMatch: /seed\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], ...browserPfad },
    },
    {
      name: 'anmelden',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['saeen'],
      use: { ...devices['Desktop Chrome'], ...browserPfad },
    },
    {
      name: 'angemeldet',
      testMatch: /(angemeldet|ablaeufe)\.spec\.ts/,
      dependencies: ['anmelden'],
      use: { ...devices['Desktop Chrome'], ...browserPfad },
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
