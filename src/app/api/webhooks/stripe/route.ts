import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { grantEntitlement, revokeActiveEntitlement } from '@/lib/billing/entitlement'
import { resolveSubscriptionOutcome, stripeClient } from '@/lib/billing/stripe'

/**
 * Wo Stripe seine Ereignisse abliefert.
 *
 * Kein `[locale]`-Segment: Stripe kennt keine Sprache und soll auch keine
 * Weiterleitung ueber die Middleware durchlaufen — die pruefte den
 * Sprachpraefix und fuende keinen, bevor sie ueberhaupt bei diesem Code
 * ankaeme.
 *
 * Drei Ereignisse zaehlen:
 *   - `checkout.session.completed` — der Kauf ist abgeschlossen, die
 *     Organisation bekommt ihre erste Zeile in vsm_billing_customers samt
 *     Abo-Id.
 *   - `customer.subscription.updated` — jede spaetere Aenderung: Verlaengert,
 *     der Tarif gewechselt, oder in Zahlungsverzug geraten
 *     (`past_due`/`unpaid` ziehen den Tarif zurueck, siehe
 *     `resolveSubscriptionOutcome`).
 *   - `customer.subscription.deleted` — die Kuendigung ist wirksam
 *     geworden, nicht die Ankuendigung. Bis dahin laeuft die Stufe normal
 *     weiter; genau das erwartet, wer fuer den laufenden Monat bezahlt hat.
 *
 * Alles andere wird bestaetigt und ignoriert: Stripe wiederholt ein
 * Ereignis, auf das 200 ausbleibt, mit steigendem Abstand bis zu drei Tage
 * lang — ein 4xx/5xx auf ein Ereignis, das uns nicht betrifft, waere ein
 * sich selbst verlaengerndes Missverstaendnis.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !secret) {
    console.error('Stripe-Webhook: Signatur oder STRIPE_WEBHOOK_SECRET fehlt.')
    return new Response('Webhook nicht eingerichtet.', { status: 500 })
  }

  // Der Rohtext, nicht das geparste JSON: Die Signaturpruefung rechnet ueber
  // die Bytes genau so, wie Stripe sie gesendet hat. Ein bereits geparster
  // und neu serialisierter Body koennte an Leerzeichen oder Schluesselreihen-
  // folge abweichen und die Pruefung faelschlich scheitern lassen.
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error('Stripe-Webhook: Signatur ungueltig:', err instanceof Error ? err.message : err)
    return new Response('Ungueltige Signatur.', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const organizationId = session.client_reference_id
        const customerId = typeof session.customer === 'string' ? session.customer : null
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null

        if (!organizationId || !customerId) {
          console.error('checkout.session.completed ohne organizationId oder customerId.')
          break
        }

        const admin = createAdminClient()
        const { error } = await admin.from('vsm_billing_customers').upsert({
          organization_id: organizationId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        if (error) throw new Error(error.message)

        // Der Tarif selbst kommt nicht aus dieser Zeile, sondern aus dem
        // Abo, das gleich als `customer.subscription.updated` folgt — Stripe
        // schickt beide Ereignisse fuer denselben Kauf. Hier nur die
        // Zuordnung eintragen, die jenes Ereignis braucht, um die
        // Organisation ueberhaupt wiederzufinden.
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object
        const organizationId = await organizationIdForCustomer(subscription.customer)
        if (!organizationId) {
          console.error('Abo-Ereignis ohne bekannten Stripe-Kunden:', subscription.customer)
          break
        }

        const priceId = subscription.items.data[0]?.price.id ?? null
        const outcome = resolveSubscriptionOutcome(subscription.status, priceId)

        if ('tier' in outcome) {
          await grantEntitlement(organizationId, outcome.tier)
        } else {
          await revokeActiveEntitlement(organizationId)
        }

        await createAdminClient()
          .from('vsm_billing_customers')
          .update({ stripe_subscription_id: subscription.id })
          .eq('organization_id', organizationId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const organizationId = await organizationIdForCustomer(subscription.customer)
        if (!organizationId) {
          console.error('Kuendigung ohne bekannten Stripe-Kunden:', subscription.customer)
          break
        }
        await revokeActiveEntitlement(organizationId)
        break
      }

      default:
        // Bewusst kein `console.log` je unbehandeltem Ereignistyp: Stripe
        // schickt deutlich mehr Ereignisse, als diese Anwendung auswertet
        // (Rechnungen, Zahlungsversuche, …), und ein Protokolleintrag pro
        // Ereignis waere nur Rauschen.
        break
    }
  } catch (err) {
    console.error('Stripe-Webhook fehlgeschlagen:', err instanceof Error ? err.message : err)
    // 500, nicht 200: Stripe soll es erneut versuchen. Ein verschluckter
    // Fehler hier heisst, eine bezahlende Kundin bleibt auf FREE stehen,
    // ohne dass es irgendwo auffiele.
    return new Response('Verarbeitung fehlgeschlagen.', { status: 500 })
  }

  return Response.json({ received: true })
}

/** Die Organisation hinter einer Stripe-Kunden-Id, oder null. */
async function organizationIdForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const customerId = typeof customer === 'string' ? customer : customer?.id
  if (!customerId) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vsm_billing_customers')
    .select('organization_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    console.error('organizationIdForCustomer failed:', error.message)
    return null
  }
  return data?.organization_id ?? null
}
