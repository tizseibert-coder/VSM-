-- Die Bruecke zwischen einer Organisation und ihrem Stripe-Kunden (2026-09-07)
--
-- `organization_entitlements` (Prisma/LeanPulse Industrial, siehe
-- supabase/README.md) kennt weder `stripe_customer_id` noch
-- `stripe_subscription_id` — und darf sie auch nicht bekommen: Eine Spalte
-- dort anzufuegen waere eine Eigentumsverletzung, keine Erweiterung. Ein
-- Stripe-Webhook braucht die Zuordnung aber in beide Richtungen: beim
-- Checkout die Organisation zum neuen Stripe-Kunden, bei jedem spaeteren
-- Ereignis (Verlaengerung, Kuendigung) den umgekehrten Weg — Stripe schickt
-- nur die Kunden-/Abo-Id mit, nie unsere organization_id.
--
-- Diese Tabelle gehoert Taktane, wie vsm_staff und vsm_leads. Sie traegt
-- keine Tarifentscheidung — die bleibt in organization_entitlements, ueber
-- dieselbe grantEntitlement()-Funktion, die auch der Verwaltungsbereich
-- benutzt (lib/billing/entitlement.ts). Diese Tabelle beantwortet nur die
-- Frage "wessen Kunde ist das".
--
-- Ohne jede Policy: Weder `anon` noch `authenticated` haben hier etwas
-- verloren, nicht einmal lesend — nur der Service-Role-Client von
-- Checkout- und Webhook-Route fasst diese Tabelle an, und der umgeht RLS
-- ohnehin. `ENABLE ROW LEVEL SECURITY` ohne Policy ist deshalb kein
-- Uebergangszustand, sondern die vollstaendige Absicherung.
CREATE TABLE IF NOT EXISTS public.vsm_billing_customers (
  organization_id      uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id    text NOT NULL UNIQUE,
  -- Null zwischen dem Anlegen des Stripe-Kunden und dem Abschluss des
  -- Checkouts — ein Kunde ohne Abo ist ein gueltiger Zwischenzustand, kein
  -- Fehler.
  stripe_subscription_id text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vsm_billing_customers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_vsm_billing_customers_updated_at ON public.vsm_billing_customers;
CREATE TRIGGER set_vsm_billing_customers_updated_at
  BEFORE UPDATE ON public.vsm_billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
