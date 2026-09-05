-- Firmenprofil und Einladungen mit eigenen Einstellungen (2026-09-05)
--
-- Anlass ist die Erprobung: Wer als Beta-Tester angesprochen wird, soll sein
-- Unternehmen in den VSM Builder mitnehmen koennen — Logo, Firmenangaben,
-- Vorgaben fuer neue Wertstroeme — und der Einladungslink, mit dem er
-- hereinkommt, soll aussehen wie eine Einladung *dieser Firma* und nicht wie
-- ein anonymer Token. Das Blatt, das am Ende im Gremium liegt, traegt dann
-- sein Logo neben unserem Namen. Genau das ist der Unterschied zwischen
-- "wir probieren ein Werkzeug aus" und "das ist unsere Wertstromanalyse".
--
-- ─────────────────────────────────────────────────────────────────────
-- Warum zwei eigene Tabellen und keine Spalten an `organizations`
-- ─────────────────────────────────────────────────────────────────────
-- `organizations` und `organization_invitations` gehoeren Prisma / LeanPulse
-- Industrial (supabase/README.md). Regel 1 dort: nie ein fremdes Objekt
-- anfassen. Ein `ALTER TABLE public.organizations ADD COLUMN logo…` waere
-- genau der Griff, der am 16.08. die Registrierung aller drei Produkte
-- lahmgelegt hat. Die Angaben liegen deshalb daneben, in Tabellen, die dem
-- VSM Builder gehoeren, und zeigen per Fremdschluessel dorthin — dasselbe
-- Muster wie `projects.organization_id`.
--
-- ─────────────────────────────────────────────────────────────────────
-- Warum das Logo in der Datenbank steht und nicht im Storage
-- ─────────────────────────────────────────────────────────────────────
-- Ein Bucket haette Policies auf `storage.objects` gebraucht — eine Tabelle,
-- die Supabase gehoert. Das ist derselbe Griff wie oben, nur eine Etage
-- tiefer, und er waere zusaetzlich ein Einrichtungsschritt, den niemand
-- sieht, bis das erste Logo nicht hochlaedt.
--
-- Der Preis ist ehrlich zu nennen: base64 in einer Textspalte ist rund ein
-- Drittel groesser als die Datei und liegt in der Zeile statt im
-- Objektspeicher. Bei einem Logo je Firma und 200 kB Obergrenze sind das
-- Groessenordnungen, die keine Rolle spielen — bei Bildern im Wertstrom waere
-- die Rechnung eine andere, und dann gehoerte hier ein Bucket hin.
--
-- Kein SVG, obwohl ein Logo als SVG die naheliegendste Form waere: Ein SVG
-- ist ein Dokument, das Skripte enthalten kann. Ausgeliefert von unserer
-- eigenen Adresse und direkt im Browser geoeffnet, laeuft es in unserem
-- Ursprung. Rastergrafik kann das nicht, und ein PNG des eigenen Logos hat
-- jede Marketingabteilung greifbar.
--
-- Idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` durchgehend).

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'Das Firmenprofil setzt public.organizations voraus (Eigentuemer: Prisma / LeanPulse Industrial). Zuerst `prisma migrate deploy` aus apps/api laufen lassen. Siehe supabase/README.md.';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION
      'Das Firmenprofil setzt auth.users voraus (Eigentuemer: Supabase).';
  END IF;
END
$$;

-- ═══════════════════════════════════════════
-- 1) vsm_org_settings — das Firmenprofil
-- ═══════════════════════════════════════════
-- Eine Zeile je Organisation, alle Spalten optional. Ohne Zeile gelten die
-- Vorgaben der Anwendung; das ist der Zustand jeder bestehenden Firma am Tag
-- des Einspielens und darf deshalb nichts kaputtmachen.
--
-- `display_name` steht neben `organizations.name` und ersetzt es nicht: Der
-- Name dort ist der, unter dem die Firma im gemeinsamen Login gefuehrt wird
-- (oft aus der Registrierung abgeleitet, "Max Muster's Organization").
-- Aendern duerfen wir ihn nicht — er gehoert dem anderen System. Wie die
-- Firma auf ihrem eigenen Blatt heissen will, ist eine andere Frage und
-- gehoert uns.
CREATE TABLE IF NOT EXISTS public.vsm_org_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Wer die Firma ist
  display_name    text,
  legal_name      text,
  industry        text,
  website         text,
  contact_email   text,
  contact_phone   text,

  -- Wie sie aussieht
  -- Die Akzentfarbe faerbt nicht die Oberflaeche um (siehe globals.css: genau
  -- eine Akzentfarbe, und die Strichzeichnung soll nicht mit ihr streiten),
  -- sondern die Kopfleiste des Blatts und den Balken auf der Einladungsseite.
  brand_color     text,
  logo_mime       text,
  logo_data       text,
  logo_file_name  text,
  logo_updated_at timestamptz,

  -- Was fuer neue Wertstroeme voreingestellt ist. Der Unterschied zwischen
  -- "einmal einstellen" und "bei jedem Projekt wieder eintippen" ist genau
  -- der, den ein Erprober als erstes bemerkt.
  default_currency          text,
  default_available_minutes numeric,
  default_locale            text,

  -- Steht unter dem Blatt, links neben dem Datum. Fuer Haeuser, die auf
  -- Ausdrucken eine Vertraulichkeitszeile oder ein Aktenzeichen brauchen.
  report_footer   text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vsm_org_settings_brand_color_check
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Nur Rastergrafik, siehe Kopf der Datei.
  CONSTRAINT vsm_org_settings_logo_mime_check
    CHECK (logo_mime IS NULL OR logo_mime = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text])),
  -- 280 000 base64-Zeichen sind rund 205 kB Datei. Die Grenze steht hier und
  -- nicht nur in der Oberflaeche: Sie schuetzt die Zeile, nicht das Formular.
  CONSTRAINT vsm_org_settings_logo_size_check
    CHECK (logo_data IS NULL OR octet_length(logo_data) <= 280000),
  -- Ein Bild ohne Typ liesse sich nicht ausliefern, ein Typ ohne Bild waere
  -- ein Rest aus einem halb gelaufenen Loeschvorgang.
  CONSTRAINT vsm_org_settings_logo_pair_check
    CHECK ((logo_data IS NULL) = (logo_mime IS NULL)),
  CONSTRAINT vsm_org_settings_default_currency_check
    CHECK (default_currency IS NULL OR default_currency = ANY (ARRAY['EUR'::text, 'CHF'::text, 'USD'::text])),
  CONSTRAINT vsm_org_settings_default_locale_check
    CHECK (default_locale IS NULL OR default_locale = ANY (ARRAY['de'::text, 'en'::text])),
  CONSTRAINT vsm_org_settings_default_minutes_check
    CHECK (default_available_minutes IS NULL OR (default_available_minutes > 0 AND default_available_minutes <= 1440))
);

COMMENT ON TABLE public.vsm_org_settings IS
  'Firmenprofil des VSM Builders: Logo, Firmenangaben und Vorgaben fuer neue Wertstroeme. Liegt neben public.organizations, weil die Tabelle Prisma gehoert (siehe supabase/README.md).';

COMMENT ON COLUMN public.vsm_org_settings.display_name IS
  'Wie die Firma auf ihrem eigenen Blatt heissen will. Ersetzt organizations.name nicht — der gehoert dem gemeinsamen Login.';

COMMENT ON COLUMN public.vsm_org_settings.logo_data IS
  'Das Logo als base64. Bewusst in der Zeile statt im Storage: ein Bucket braeuchte Policies auf storage.objects, einer fremden Tabelle. Gilt fuer ein Logo je Firma, nicht als Muster fuer Bilder allgemein.';

-- ═══════════════════════════════════════════
-- 2) vsm_invite_settings — was an einer Einladung haengt
-- ═══════════════════════════════════════════
-- Die Einladung selbst steht in `organization_invitations` (Prisma). Alles,
-- was der VSM Builder darueber hinaus dazu weiss, steht hier: fuer wen der
-- Link gedacht war, was der Empfaenger auf der Einladungsseite lesen soll,
-- und ob er dabei das Logo der einladenden Firma sieht.
--
-- Der Schluessel ist `token_hash`, nicht `organization_invitations.id`, und
-- das hat einen Grund, der ueber Eigentumsfragen hinausgeht: Die
-- Einladungsseite muss die Firmenangaben zeigen, *bevor* der Empfaenger
-- angemeldet ist. Ein Fremdschluessel auf die Einladung wuerde bedeuten,
-- dass jeder Aufruf zuerst die fremde Tabelle liest, um dann hier
-- nachzuschlagen. Mit dem Hash als Schluessel genuegt eine Abfrage in einer
-- Tabelle, die uns gehoert.
--
-- Der Hash ist derselbe, den `createInvite` in beide Tabellen schreibt
-- (sha256 des rohen Tokens, hex). Er ist kein neues Geheimnis: Er steht
-- ohnehin schon in der Einladung, und aus ihm laesst sich der Token nicht
-- zurueckrechnen.
--
-- Kein ON DELETE von der Einladung her: Einladungen werden nicht geloescht,
-- sondern zurueckgezogen (`revoked_at`) — die Liste soll erklaeren koennen,
-- warum ein Link nicht mehr geht. Verschwindet die Organisation, geht diese
-- Zeile ueber `organization_id` mit.
CREATE TABLE IF NOT EXISTS public.vsm_invite_settings (
  token_hash      text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Fuer die Liste im Team-Bereich. Ohne sie unterscheiden sich fuenf offene
  -- Einladungen nur durch ihr Erstellungsdatum, und niemand weiss mehr,
  -- welcher Link an wen ging.
  label           text,
  invitee_name    text,
  invitee_company text,

  -- Steht auf der Einladungsseite ueber dem Knopf. Der Unterschied zwischen
  -- "Sie wurden eingeladen, einem Team beizutreten" und "Herr Weber, wie
  -- besprochen — hier ist der Zugang zur Erprobung" ist der zwischen einem
  -- Systemhinweis und einer Kontaktaufnahme.
  welcome_message text,
  show_branding   boolean NOT NULL DEFAULT true,

  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vsm_invite_settings_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Ein Text, den niemand liest, weil er nicht auf die Seite passt, ist
  -- schlimmer als keiner: Der Absender glaubt, er habe etwas mitgeteilt.
  CONSTRAINT vsm_invite_settings_welcome_length_check
    CHECK (welcome_message IS NULL OR char_length(welcome_message) <= 600)
);

CREATE INDEX IF NOT EXISTS idx_vsm_invite_settings_organization_id
  ON public.vsm_invite_settings USING btree (organization_id);

COMMENT ON TABLE public.vsm_invite_settings IS
  'Was der VSM Builder ueber eine Einladung hinaus weiss (Empfaenger, Begruessung, Branding). Verknuepft ueber den sha256-Hash des Einladungstokens, denselben, der in organization_invitations steht.';

-- ═══════════════════════════════════════════
-- 3) Rechte
-- ═══════════════════════════════════════════
-- Der VSM Builder greift als `authenticated` ueber PostgREST zu. Ohne Policy
-- ist eine Tabelle mit RLS fuer ihn leer.

ALTER TABLE public.vsm_org_settings ENABLE ROW LEVEL SECURITY;

-- Lesen ab `viewer`: Jedes Mitglied sieht das Logo in der Kopfleiste und
-- bekommt es beim PDF-Export mit aufs Blatt. Ein Profil, das nur der Inhaber
-- lesen kann, waere fuer alle anderen unsichtbar — und damit fuer das Blatt,
-- um das es geht, wirkungslos.
DROP POLICY IF EXISTS "members can view org settings" ON public.vsm_org_settings;
CREATE POLICY "members can view org settings"
  ON public.vsm_org_settings FOR SELECT
  TO authenticated
  USING (has_org_role(organization_id, 'viewer'));

-- Schreiben nur als `owner`, nicht ab `editor`: Das Logo und der Firmenname
-- auf dem Blatt sind der Aussenauftritt des Hauses, kein Arbeitsstand an
-- einem Wertstrom.
DROP POLICY IF EXISTS "owners can write org settings" ON public.vsm_org_settings;
CREATE POLICY "owners can write org settings"
  ON public.vsm_org_settings FOR ALL
  TO authenticated
  USING (has_org_role(organization_id, 'owner'))
  WITH CHECK (has_org_role(organization_id, 'owner'));

ALTER TABLE public.vsm_invite_settings ENABLE ROW LEVEL SECURITY;

-- Nur Inhaber, lesend wie schreibend — dieselbe Grenze wie bei den
-- Einladungen selbst. `invitee_name` und `invitee_company` sind
-- personenbezogene Notizen ueber jemanden, der noch nicht einmal Nutzer ist.
DROP POLICY IF EXISTS "owners can read invite settings" ON public.vsm_invite_settings;
CREATE POLICY "owners can read invite settings"
  ON public.vsm_invite_settings FOR SELECT
  TO authenticated
  USING (has_org_role(organization_id, 'owner'));

DROP POLICY IF EXISTS "owners can write invite settings" ON public.vsm_invite_settings;
CREATE POLICY "owners can write invite settings"
  ON public.vsm_invite_settings FOR ALL
  TO authenticated
  USING (has_org_role(organization_id, 'owner'))
  WITH CHECK (has_org_role(organization_id, 'owner'));

-- Bewusst *keine* Policy fuer `anon`: Die Einladungsseite braucht die Zeile,
-- bevor der Empfaenger angemeldet ist, und ein `USING (true)` dafuer waere
-- ein offenes Leserecht auf alle Einladungen aller Firmen — jeder mit dem
-- publishable key haette die Liste, wer wen anspricht. Die Seite liest
-- stattdessen serverseitig mit dem Service-Role-Schluessel, gezielt ueber
-- den Hash des Tokens, den nur der Empfaenger hat, und gibt nur
-- Anzeigeangaben heraus (src/lib/org/inviteBranding.ts).

-- ═══════════════════════════════════════════
-- 4) updated_at
-- ═══════════════════════════════════════════
-- `set_updated_at()` kommt aus 20260830160000_vsm_authorization_layer.sql.
DROP TRIGGER IF EXISTS set_vsm_org_settings_updated_at ON public.vsm_org_settings;
CREATE TRIGGER set_vsm_org_settings_updated_at
  BEFORE UPDATE ON public.vsm_org_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
