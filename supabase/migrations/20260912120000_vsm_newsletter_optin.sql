-- Newsletter-Doppel-Opt-in (2026-09-12)
--
-- Hintergrund: docs/vertrieb-crm-und-freemium.md nannte zwei bewusste
-- Luecken — "Double-Opt-in" und "Mailversand ueberhaupt". Das Formular auf
-- der Verkaufsseite speicherte bis hierher nur die einfache Einwilligung,
-- Angaben zur Beantwortung der Anfrage zu speichern (`consent_at`,
-- `consent_text`). Eine Einwilligung *fuer den Newsletter* ist rechtlich
-- etwas anderes und braucht nach DSGVO/UWG einen Bestaetigungsschritt: Wer
-- das Kaestchen ankreuzt, bekommt eine Mail mit einem Bestaetigungslink, und
-- erst der Klick darauf zaehlt als Einwilligung — nicht das Ankreuzen allein
-- (sonst koennte jeder eine fremde Adresse eintragen).
--
-- Getrennt von `consent_at`/`consent_text`, nicht als deren Erweiterung: Ein
-- Interessent kann der Beantwortung seiner Anfrage zustimmen, ohne den
-- Newsletter zu wollen, und umgekehrt kann sich jemand nur fuer den
-- Newsletter eintragen (leeres Nachrichtenfeld). Zwei Einwilligungen, zwei
-- Zeitstempel, zwei Wortlaute.
--
-- Der Token wird wie bei organization_invitations nur gehasht abgelegt
-- (sha256, siehe team/actions.ts) — der rohe Token steht ausschliesslich im
-- Mail-Link. Eine Kopie der Datenbank gibt damit niemandem die Moeglichkeit,
-- fremde Anmeldungen zu bestaetigen.
--
-- Idempotent (`ADD COLUMN IF NOT EXISTS`, Check-Constraint per DO-Block).

ALTER TABLE public.vsm_leads
  ADD COLUMN IF NOT EXISTS newsletter_consent_text text,
  ADD COLUMN IF NOT EXISTS newsletter_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_confirm_token_hash text,
  ADD COLUMN IF NOT EXISTS newsletter_confirm_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_confirmed_at timestamptz;

-- Ein Token gehoert genau einem Interessenten. Ohne diesen Index muesste
-- confirmNewsletter() ueber die ganze Tabelle scannen, um den Hash
-- wiederzufinden — bei einer Handvoll Interessenten unwichtig, aber die
-- richtige Spalte fuer einen Bestaetigungslink, der jederzeit wachsen kann.
CREATE UNIQUE INDEX IF NOT EXISTS vsm_leads_newsletter_confirm_token_hash_key
  ON public.vsm_leads (newsletter_confirm_token_hash)
  WHERE newsletter_confirm_token_hash IS NOT NULL;

COMMENT ON COLUMN public.vsm_leads.newsletter_consent_text IS
  'Der Wortlaut der Newsletter-Einwilligung zum Zeitpunkt des Ankreuzens. Getrennt von consent_text: eine spaetere Textaenderung darf eine alte Zustimmung nicht unbelegbar machen.';
COMMENT ON COLUMN public.vsm_leads.newsletter_confirmed_at IS
  'Erst der Klick auf den Bestaetigungslink zaehlt als Einwilligung, nicht das Ankreuzen im Formular (newsletter_requested_at). Solange NULL, gilt niemand als Abonnent.';

-- Die Chronik bekommt einen weiteren Ereignistyp: der bestaetigte Klick.
-- Das Absenden der Bestaetigungsmail selbst ist keinen eigenen Eintrag wert
-- (das steht schon im 'form'-Ereignis der Erfassung) — erst die Bestaetigung
-- ist ein Ereignis, das der Vertrieb in der Chronik sehen will.
DO $$
BEGIN
  ALTER TABLE public.vsm_lead_events DROP CONSTRAINT IF EXISTS vsm_lead_events_kind_check;
  ALTER TABLE public.vsm_lead_events
    ADD CONSTRAINT vsm_lead_events_kind_check CHECK (kind = ANY (ARRAY[
      'form'::text, 'signup'::text, 'note'::text, 'stage_change'::text,
      'owner_change'::text, 'project_created'::text, 'plan_change'::text,
      'system'::text, 'newsletter_confirmed'::text
    ]));
END $$;
