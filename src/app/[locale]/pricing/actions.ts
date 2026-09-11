'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { localizedUrl } from '@/lib/seo/site'
import { isPurchasableTier, priceIdForTier, stripeClient } from '@/lib/billing/stripe'
import { visitorCurrency } from '@/lib/billing/currency'
import { redirect as externalRedirect } from 'next/navigation'
import { redirectLocalized } from '@/lib/nav/localeRedirect'

/** Uebersetzte Fehlermeldungen fuer die ?error=-Anzeige auf der Preisseite. */
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}

/**
 * Startet ein Stripe-Checkout fuer eine kaufbare Stufe.
 *
 * Nur ueber ein angemeldetes Konto mit eigener Organisation, und nur als
 * `owner` — dieselbe Grenze wie beim Einladen (siehe team/actions.ts): Wer
 * ein Abo abschliesst, bindet die ganze Organisation an eine wiederkehrende
 * Zahlung, nicht nur sich selbst.
 *
 * Ohne bestehendes Konto fuehrt der Weg ueber die Anmeldung zurueck hierher —
 * ein Kauf vor der Kontoerstellung wuerde eine Organisation ohne Mitglieder
 * brauchen, die es im Datenmodell nicht gibt.
 *
 * Die `redirectLocalized(, locale)`-Ziele hier sind bewusst ohne Sprachpraefix (`/pricing`,
 * nicht `/de/pricing`) — derselbe Weg wie in team/actions.ts und
 * admin/actions.ts: next-intls Middleware faengt den fehlenden Praefix ab
 * und ergaenzt ihn aus Cookie/Accept-Language, nur mit einem zusaetzlichen
 * Sprung. `localizedUrl()` liefert dagegen eine *absolute* Adresse mit der
 * echten Produktionsdomain — richtig fuer Stripes success_url/cancel_url,
 * die den Browser von stripe.com aus zurueckschicken, aber falsch fuer
 * einen internen Sprung: In einer Vorschau-Umgebung liefe der sonst auf die
 * Produktionsseite hinaus statt auf sich selbst zurueck.
 */
export async function startCheckout(tier: string) {
  const locale = await getLocale()
  if (!isPurchasableTier(tier)) {
    redirectLocalized('/pricing?error=tier', locale)
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    redirectLocalized('/login?next=/pricing', locale)
  }

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirectLocalized('/pricing?error=noOrg', locale)
  }
  if (orgResult.active.role !== 'owner') {
    redirectLocalized('/pricing?error=notOwner', locale)
  }

  let priceId: string
  try {
    priceId = priceIdForTier(tier, await visitorCurrency())
  } catch (err) {
    console.error('startCheckout (price) failed:', err instanceof Error ? err.message : err)
    redirectLocalized('/pricing?error=notConfigured', locale)
  }

  const organizationId = orgResult.active.organizationId
  const email = claimsData.claims.email as string | undefined

  let sessionUrl: string | null = null
  try {
    const stripe = stripeClient()
    const admin = createAdminClient()

    // Ein Stripe-Kunde je Organisation, nicht je Nutzer — die Zuordnung
    // steckt in vsm_billing_customers (lib/billing/stripe.ts erklaert, warum
    // sie dort und nicht in organization_entitlements steht). Existiert
    // schon einer, wird er wiederverwendet: ein zweiter Kunde fuer dieselbe
    // Organisation waere im Stripe-Dashboard nicht mehr auseinanderzuhalten.
    const { data: existing } = await admin
      .from('vsm_billing_customers')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .maybeSingle()

    let customerId = existing?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { organization_id: organizationId },
      })
      customerId = customer.id
      const { error: upsertError } = await admin.from('vsm_billing_customers').upsert({
        organization_id: organizationId,
        stripe_customer_id: customerId,
      })
      if (upsertError) throw new Error(upsertError.message)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Absolut, weil Stripe von seiner eigenen Domain aus zurueckschickt —
      // ein relativer Pfad haette dort keinen Ursprung, gegen den er
      // aufgeloest werden koennte.
      success_url: localizedUrl(locale, '/dashboard') + '?checkout=success',
      cancel_url: localizedUrl(locale, '/pricing') + '?checkout=cancelled',
    })
    sessionUrl = session.url
  } catch (err) {
    console.error('startCheckout failed:', err instanceof Error ? err.message : err)
    redirectLocalized('/pricing?error=' + encodeURIComponent(await tErr('checkoutFailed')), locale)
  }

  if (!sessionUrl) {
    redirectLocalized('/pricing?error=' + encodeURIComponent(await tErr('checkoutFailed')), locale)
  }

  // Nackte Umleitung: Das Ziel liegt bei Stripe. next-intl liesse eine
  // fremde Adresse zwar unberuehrt, aber sie durch eine sprachbewusste
  // Umleitung zu schicken laese sich wie ein Versehen.
  externalRedirect(sessionUrl)
}

/**
 * Oeffnet das Stripe-Kundenportal, damit ein Inhaber sein Abo selbst
 * verwaltet — kuendigen eingeschlossen.
 *
 * [Marketing-Audit 2026-09-07, B5-Folgefund] Die Preisseite versprach seit
 * der Risikoumkehr-Zeile "keine Mindestlaufzeit", aber es gab dafuer keinen
 * Selbstbedienungsweg: kein Kundenportal, keine Funktion im Dashboard, keine
 * FAQ-Antwort. Wer kuendigen wollte, haette schreiben muessen, ohne zu
 * wissen, an wen.
 *
 * Das Stripe-Portal statt einer eigenen Kuendigungsseite: Es zeigt Rechnungen,
 * Zahlungsmittel und die Kuendigung selbst in einer von Stripe gepflegten
 * Oberflaeche, die PCI-Anforderungen bereits erfuellt. Eine eigene Seite
 * muesste all das nachbauen, um nicht schlechter zu sein — und jede Zeile
 * davon waere eine Stelle, an der ein Kuendigungswunsch haengen bleiben kann.
 *
 * Dieselbe Berechtigungsgrenze wie beim Abschluss (`startCheckout`): nur
 * `owner`. Wer ein Abo abschliessen darf, soll es auch beenden duerfen — und
 * nicht mehr als das.
 */
export async function openBillingPortal() {
  const locale = await getLocale()
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    redirectLocalized('/login?next=/dashboard', locale)
  }

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirectLocalized('/dashboard?error=' + encodeURIComponent(await tErr('checkoutNoOrg')), locale)
  }
  if (orgResult.active.role !== 'owner') {
    redirectLocalized(
      '/dashboard?error=' + encodeURIComponent(await tErr('portalNotOwner')),
      locale
    )
  }

  // `vsm_billing_customers` hat mit Absicht keine Policy fuer `authenticated`
  // (siehe die Migration) — Service-Role ist hier keine Abkuerzung, sondern
  // der einzige Weg, der ueberhaupt etwas liefert.
  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('vsm_billing_customers')
    .select('stripe_customer_id')
    .eq('organization_id', orgResult.active.organizationId)
    .maybeSingle()

  if (!customer) {
    // Der Tarif kann auch von Hand im Verwaltungsbereich vergeben worden
    // sein (BETA, oder eine Ausnahme) — dann gibt es nie einen Stripe-Kunden,
    // und das Portal haette nichts zu zeigen.
    redirectLocalized(
      '/dashboard?error=' + encodeURIComponent(await tErr('portalNoCustomer')),
      locale
    )
  }


  let portalUrl: string | null = null
  try {
    const stripe = stripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: localizedUrl(locale, '/dashboard'),
    })
    portalUrl = session.url
  } catch (err) {
    console.error('openBillingPortal failed:', err instanceof Error ? err.message : err)
    redirectLocalized('/dashboard?error=' + encodeURIComponent(await tErr('portalFailed')), locale)
  }

  // Nackte Umleitung: Das Ziel liegt bei Stripe. next-intl liesse eine
  // fremde Adresse zwar unberuehrt, aber sie durch eine sprachbewusste
  // Umleitung zu schicken laese sich wie ein Versehen.
  externalRedirect(portalUrl)
}
