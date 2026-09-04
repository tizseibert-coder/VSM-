import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Der einzige Zugang mit Eigentuemerrechten im ganzen Projekt.
 *
 * Alles andere im VSM Builder greift als `authenticated` ueber PostgREST zu
 * und faellt damit unter RLS — das ist der Grund, warum ein Fehler in einer
 * Policy die Anwendung funktionslos macht statt unsicher. Dieser Client
 * umgeht RLS vollstaendig. Er existiert fuer genau drei Vorgaenge, die anders
 * nicht gehen:
 *
 *   1. Interessenten erfassen. Das Formular auf der Verkaufsseite wird von
 *      Nichtangemeldeten ausgefuellt. Die Alternative waere eine Policy
 *      `TO anon WITH CHECK (true)` auf `vsm_leads` — ein offenes Schreibrecht
 *      auf eine Tabelle mit personenbezogenen Daten fuer jeden, der den
 *      publishable key aus dem Quelltext liest.
 *   2. E-Mail-Adressen zu Nutzern. `auth.users` ist ueber PostgREST nicht
 *      lesbar (und ein Spiegel braeuchte einen zweiten Trigger auf einer
 *      Tabelle, die uns nicht gehoert — siehe supabase/README.md).
 *   3. Tarife vergeben. `organization_entitlements` gehoert Prisma; welche
 *      Policies dort haengen, entscheidet das andere Repository und kann sich
 *      aendern, ohne dass es hier auffiele.
 *
 * Jede Stelle, die ihn benutzt, prueft **vorher** ueber
 * `requireStaff()`/`requireAdmin()`, ob der angemeldete Nutzer das darf. Der
 * Client selbst prueft nichts — er ist die Umgehung, nicht die Kontrolle.
 */

/** Wirft, statt still einen kaputten Client zu liefern: Ein fehlender
 *  Schluessel ist ein Konfigurationsfehler des Betriebs, kein Laufzeitfall,
 *  den die Oberflaeche abfangen koennte. */
export function createAdminClient() {
  // Der Schluessel darf das Buendel des Browsers nie erreichen. Next wuerde
  // eine Server-Umgebungsvariable dort ohnehin durch `undefined` ersetzen,
  // was einen stillen 401 ergaebe statt einer Erklaerung.
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() wurde im Browser aufgerufen. Der Service-Role-Schluessel gehoert ausschliesslich auf den Server.'
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (und NEXT_PUBLIC_SUPABASE_URL) fehlen. Ohne sie gibt es weder Interessentenerfassung noch Verwaltungsbereich — siehe .env.example.'
    )
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      // Dieser Client hat keinen Nutzer und darf sich keinen merken: Ein
      // persistiertes Token waere ueber Anfragen hinweg geteilt.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/** Ob der Service-Role-Schluessel ueberhaupt konfiguriert ist. Damit die
 *  Oberflaeche „nicht eingerichtet" sagen kann, statt in einen Fehler zu
 *  laufen. */
export function hasAdminCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
