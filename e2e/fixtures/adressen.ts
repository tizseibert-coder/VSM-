/**
 * Adressmuster mit Sprachpraefix.
 *
 * Diese Muster waren eine Zeit lang freigestellt (`/(de\/)?`), weil elf
 * Action-Dateien mit dem nackten `redirect` aus next/navigation umleiteten und
 * die Adresse deshalb ohne Praefix stehen blieb. Das ist behoben: Alle
 * Umleitungen gehen jetzt ueber `redirectLocalized`, und damit sind diese
 * Muster wieder das, was `localePrefix: 'always'` verspricht — und zugleich
 * die Regressionsprobe dafuer. Wird die Umstellung irgendwo zurueckgedreht,
 * faellt sie hier auf.
 */
export const DASHBOARD = /\/de\/dashboard/
export const EDITOR = /\/de\/editor\//

/** Dasselbe auf Englisch. Siehe angemeldet.spec.ts: Liefert getLocale() in
 *  einer Server Action stillschweigend die Standardsprache, landet ein
 *  englischer Nutzer auf der deutschen Seite — das faellt nur hier auf. */
export const DASHBOARD_EN = /\/en\/dashboard/
export const EDITOR_EN = /\/en\/editor\//
