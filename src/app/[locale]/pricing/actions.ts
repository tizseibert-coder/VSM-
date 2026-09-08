'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveOrg } from '@/lib/org/activeOrg'
import { localizedUrl } from '@/lib/seo/site'
import { isPurchasableTier, priceIdForTier, stripeClient } from '@/lib/billing/stripe'
import { visitorCurrency } from '@/lib/billing/currency'

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
 * Die `redirect()`-Ziele hier sind bewusst ohne Sprachpraefix (`/pricing`,
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
  if (!isPurchasableTier(tier)) {
    redirect('/pricing?error=tier')
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    redirect('/login?next=/pricing')
  }

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirect('/pricing?error=noOrg')
  }
  if (orgResult.active.role !== 'owner') {
    redirect('/pricing?error=notOwner')
  }

  let priceId: string
  try {
    priceId = priceIdForTier(tier, await visitorCurrency())
  } catch (err) {
    console.error('startCheckout (price) failed:', err instanceof Error ? err.message : err)
    redirect('/pricing?error=notConfigured')
  }

  const organizationId = orgResult.active.organizationId
  const email = claimsData.claims.email as string | undefined
  const locale = await getLocale()

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
    redirect('/pricing?error=' + encodeURIComponent(await tErr('checkoutFailed')))
  }

  if (!sessionUrl) {
    redirect('/pricing?error=' + encodeURIComponent(await tErr('checkoutFailed')))
  }

  redirect(sessionUrl)
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
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    redirect('/login?next=/dashboard')
  }

  const orgResult = await getActiveOrg()
  if ('error' in orgResult) {
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('checkoutNoOrg')))
  }
  if (orgResult.active.role !== 'owner') {
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('portalNotOwner')))
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
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('portalNoCustomer')))
  }

  const locale = await getLocale()

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
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('portalFailed')))
  }

  redirect(portalUrl)
}
