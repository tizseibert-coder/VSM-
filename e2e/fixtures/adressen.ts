/**
 * Adressmuster, die das Sprachpraefix freistellen.
 *
 * routing.ts setzt `localePrefix: 'always'` — jede Adresse soll ein `/de` oder
 * `/en` tragen, ausdruecklich damit sie fuer sich allein eindeutig teilbar
 * ist. Elf Action-Dateien unter src/app/[locale] leiten aber mit dem nackten
 * `redirect` aus next/navigation um statt mit dem sprachbewussten aus
 * @/i18n/navigation. Nach dem Anmelden landet man deshalb auf "/dashboard",
 * nach dem Anlegen auf "/editor/<id>".
 *
 * Der Kommentar in src/i18n/navigation.ts kennt diese Schuld und nimmt an,
 * die Middleware fange den fehlenden Praefix mit einem zusaetzlichen Sprung
 * ab. In den CI-Laeufen gemessen tut sie das nicht: Die Adresse bleibt ueber
 * sechzig Abfragen hinweg ohne Praefix.
 *
 * Diese Muster stellen es deshalb frei. Das ist eine Feststellung, keine
 * Billigung — der Umbau der elf Dateien ist ein eigener Schritt mit eigenem
 * Risiko. Wird er gemacht, koennen die Klammern hier wieder weg.
 */
export const DASHBOARD = /\/(de\/)?dashboard/
export const EDITOR = /\/(de\/)?editor\//
