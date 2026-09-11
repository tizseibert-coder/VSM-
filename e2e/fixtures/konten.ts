/**
 * Die Testkonten der lokalen Supabase-Instanz.
 *
 * Drei Konten, weil drei verschiedene Dinge zu pruefen sind — und weil der
 * Layout-Fehler, der diesen ganzen Schritt ausgeloest hat, nur mit dem
 * Betriebskonto sichtbar ist: Erst eine Zeile in `vsm_staff` bringt den
 * vierten Knopf in den Dashboard-Kopf.
 *
 * Kein Konto und kein Schluessel kommt aus einem Geheimnis. Die Schluessel
 * einer lokalen Instanz sind fest und oeffentlich dokumentiert; sie taugen
 * fuer nichts ausser fuer diese Instanz.
 */

export interface Konto {
  email: string
  passwort: string
  /** Datei mit dem angemeldeten Sitzungsstand, von e2e/auth.setup.ts erzeugt. */
  sitzung: string
}

export const MITGLIED: Konto = {
  email: 'mitglied@taktane.test',
  passwort: 'Taktane-Test-2026!',
  sitzung: 'e2e/.sitzungen/mitglied.json',
}

/** Zusaetzlich in vsm_staff — erst damit stehen vier Knoepfe im Kopf. */
export const BETRIEB: Konto = {
  email: 'betrieb@taktane.test',
  passwort: 'Taktane-Test-2026!',
  sitzung: 'e2e/.sitzungen/betrieb.json',
}

/** Mitglied einer *anderen* Organisation, fuer die Berechtigungsgrenze. */
export const FREMD: Konto = {
  email: 'fremd@taktane.test',
  passwort: 'Taktane-Test-2026!',
  sitzung: 'e2e/.sitzungen/fremd.json',
}

export const ALLE_KONTEN = [MITGLIED, BETRIEB, FREMD] as const

/** Feste Kennungen, damit die Tests sie ohne Umweg ueber eine Abfrage kennen. */
export const ORG_EIGEN = '00000000-0000-4000-8000-000000000001'
export const ORG_FREMD = '00000000-0000-4000-8000-000000000002'

/**
 * Der Wertstrom, den `fremd@taktane.test` nicht sehen darf. Angelegt im
 * Seed-Skript, damit die Berechtigungsgrenze eine feste Adresse hat.
 */
export const PROJEKT_EIGEN = '00000000-0000-4000-8000-000000000101'

export const LOKAL = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
}
