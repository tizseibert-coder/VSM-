/**
 * Die Seiten, die ohne Anmeldung erreichbar sind.
 *
 * Die Middleware (src/lib/supabase/proxy.ts) schuetzt /dashboard, /editor,
 * /settings und /admin — ohne Anmeldung leiten sie auf /login. Diese Liste
 * ist deshalb nicht "alle Seiten", sondern "alle, die ein anonymer Durchlauf
 * sehen kann".
 *
 * /demo ist der Gluecksfall darunter: Die vollstaendige Zeichenflaeche samt
 * Kennzahlenleiste und Bearbeitungspanels haengt dort ohne Anmeldung.
 */
export const PUBLIC_PAGES = [
  { path: '/de', name: 'Startseite' },
  { path: '/de/demo', name: 'Demo mit Zeichenflaeche' },
  { path: '/de/data-sheet', name: 'Erhebungsbogen' },
  { path: '/de/pricing', name: 'Preise' },
  { path: '/de/login', name: 'Anmeldung' },
  { path: '/de/signup', name: 'Registrierung' },
] as const

/**
 * Die Breiten, bei denen gemessen wird.
 *
 * 320 ist das schmalste noch verbreitete Telefon, 390 ein iPhone der
 * mittleren Groesse (die Breite, bei der der Dashboard-Kopf aus dem Bild
 * lief), 768 ein Tablet hochkant, 1280 der Schreibtisch.
 */
export const WIDTHS = [320, 390, 768, 1280] as const
