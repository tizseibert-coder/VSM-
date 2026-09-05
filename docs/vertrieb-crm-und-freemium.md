# Vertrieb, CRM und Freemium (04.09.2026)

Bis hierher endete die Kette bei der Registrierung. Wer sich anmeldete, bekam
eine Organisation und war ab da ein Nutzer wie jeder andere; was davor lag —
woher jemand kam, worauf er geklickt hat, ob ihn schon einmal jemand angerufen
hat — stand nirgends. Und die Verkaufsseite hatte kein Formular, ueber das
jemand haette fragen koennen, ohne sich vorher anzumelden.

Dieses Dokument beschreibt, was seitdem da ist, in welcher Reihenfolge es
scharfgestellt wird, und was bewusst fehlt.

## Die vier Teile

```
Besuch mit ?utm_source=…            src/proxy.ts
        │                           schreibt einmalig das Cookie vsm_attr
        ▼
Formular  oder  Registrierung       LeadForm → lead-actions.ts
        │                           signup/actions.ts → noteSignup()
        ▼
vsm_leads + vsm_lead_events         lib/crm/leads.ts (Service-Role)
        │
        ▼
/admin                              lib/crm/staff.ts entscheidet, wer hineindarf
        │
        ▼
organization_entitlements           Tarifvergabe (Prisma-Tabelle, nur Zeilen)
        │
        ▼
createProject / createInvite /      lib/billing/entitlement.ts
createScenario                      pruefen die Grenze — wenn eingeschaltet
```

### 1. Herkunft (`src/lib/crm/attribution.ts`, `src/proxy.ts`)

Der Proxy schreibt beim ersten Besuch ein Erstanbieter-Cookie mit den
utm-Feldern, der Verweisquelle und der Einstiegsseite. **Erster Schreiber
gewinnt**: Wer ueber eine LinkedIn-Anzeige kommt, sich umsieht und erst beim
dritten Besuch ueber die Google-Suche registriert, ist ein Treffer der Anzeige.
Ein Cookie, das jeder Besuch ueberschreibt, schriebe der Suchmaschine gut, was
die Anzeige gebracht hat.

Direktverkehr setzt kein Cookie — eines, in dem nur der Pfad steht, ist ein
Cookie ohne Aussage. `gclid` und Verwandte bleiben draussen: Das sind Kennungen
einzelner Klicks bei einem Anzeigenanbieter, keine Kampagne.

### 2. Erfassung (`src/lib/crm/leads.ts`)

Eine Zeile je Person (eindeutig ueber `lower(email)`), nicht je
Kontaktaufnahme. Beim zweiten Ausfuellen werden nur **Luecken** gefuellt: Der
knappe zweite Eintrag darf den ausfuehrlichen ersten nicht ueberschreiben. Die
Herkunft wird nur beim Anlegen gesetzt.

Geschrieben wird mit Service-Role, nicht als `anon`. Die Alternative waere eine
Policy `TO anon WITH CHECK (true)` auf einer Tabelle mit personenbezogenen
Daten gewesen — ein offenes Schreibrecht fuer jeden, der den publishable key
aus dem Quelltext liest.

**DSGVO:** Gespeichert wird nicht nur *dass* eingewilligt wurde, sondern der
**Wortlaut** (`consent_text`). Ein spaeter geaenderter Formulartext macht sonst
jede alte Einwilligung unbelegbar. Das Formular hat keine vorangekreuzte
Zustimmung und ein unsichtbares Koederfeld gegen Formularausfueller.

### 3. Der Verwaltungsbereich (`/admin`)

Vier Ansichten: Uebersicht (der Trichter in Zahlen), Interessenten (Liste mit
Filtern in der Adresse, also teilbar), ein Interessent mit Chronik und
Notizfeld, die Nutzerliste und die Organisationen mit Tarifvergabe.

Wer hineindarf, steht in `vsm_staff` — der **Betreiberseite**, unabhaengig von
`organization_members`. Zwei Stufen: `sales` pflegt Interessenten, `admin` darf
zusaetzlich Tarife vergeben. Wer nicht in der Tabelle steht, bekommt 404 statt
„Kein Zugriff": Letzteres waere die Bestaetigung, nach der jemand sucht, der
die Adresse geraten hat. Den ersten Eintrag legt man von Hand an — siehe
`supabase/README.md`, „Den ersten Betreiber eintragen".

Die Chronik ist anfuegend, nicht aenderbar (dieselbe Linie wie
`activity_logs`): Ein Gespraechsprotokoll, das man nachtraeglich glattziehen
kann, ist als Beleg wertlos.

### 4. Freemium (`src/lib/billing/`)

`plans.ts` haelt die Grenzen je Stufe — und zwar als **einzige** Quelle: Die
Preisseite liest dieselben Zahlen wie `createProject`. Eine handgepflegte
Tabelle daneben waere binnen einer Aenderung falsch, und Falschangaben auf der
Preisseite sind die teuerste Sorte Fehler in diesem Projekt.

Der Tarif selbst kommt aus `organization_entitlements`, der Prisma-Tabelle, die
alle drei Produkte teilen (`AppProduct`, `Tier`). Keine eigene Tabelle: Zwei
Stellen, an denen „der Kunde ist auf PROFESSIONAL" steht, widersprechen sich
irgendwann.

## Scharfstellen — in dieser Reihenfolge

1. **Migration einspielen.** `supabase/migrations/20260904175944_vsm_crm_and_staff.sql`.
   Idempotent; gegen eine leere Datenbank geprueft mit
   `supabase/tests/leere-datenbank-pruefen.sh`.
2. **`SUPABASE_SERVICE_ROLE_KEY` setzen.** Ohne ihn nimmt das Formular
   Anfragen entgegen, speichert sie aber nicht, und die Nutzer- und
   Organisationsliste bleiben leer. Beides sagt die Oberflaeche unter `/admin`
   ausdruecklich, statt es zu verschweigen.
3. **Den ersten Betreiber in `vsm_staff` eintragen** (SQL in
   `supabase/README.md`).
4. **`NEXT_PUBLIC_SITE_URL` zur Bauzeit setzen.** `robots.txt` und
   `sitemap.xml` werden beim `next build` erzeugt und eingefroren — ohne die
   Variable steht `http://localhost:3000` in der Sitemap, die Google abholt.
5. **Die Tarife der bestehenden Kunden setzen** unter `/admin/organizations`.
   Die Liste faerbt rot, wer ueber der Grenze seines Tarifs liegt; das ist
   genau die Liste, die man vorher durchgeht.
6. **Erst dann `VSM_PLAN_ENFORCEMENT=on`.**

Schritt 5 vor 6 ist keine Empfehlung. Ohne Zeile in
`organization_entitlements` gilt eine Organisation als FREE, also mit *einem*
Wertstrom. Wer die Durchsetzung am selben Tag anschaltet, an dem er diesen
Stand einspielt, nimmt jedem bestehenden Haus die Wertstroeme zwei bis fuenf
weg. Bis dahin zeigt die Oberflaeche Verbrauch und Grenze schon an — der Teil,
der niemandem etwas wegnimmt.

## SEO und geteilte Links

- `app/robots.ts` sperrt `/admin`, `/dashboard`, `/editor`, `/invite` und
  `/auth` (je einmal ohne und einmal mit Sprachpraefix — robots.txt kennt keine
  regulaeren Ausdruecke ausser `*` und `$`). Der Rest ist ausdruecklich offen:
  Verkaufsseite, Preise, Demo und Erhebungsbogen sind der Grund, warum es die
  Datei gibt.
- `app/sitemap.ts` fuehrt jede oeffentliche Seite je Sprache mit
  `hreflang`-Verweisen auf ihre Entsprechungen und `x-default`.
- Jede oeffentliche Seite setzt kanonische Adresse, Sprachalternativen und
  `og:url` ueber `pageMetadata()` in `src/lib/seo/site.ts`. `og:url` ist die
  Stelle, an der es sonst still schiefgeht: Ohne ihn nimmt LinkedIn die
  Adresse, ueber die sein Roboter kam — wer den Link mit `?utm_source=…` teilt,
  bekommt die Kampagnenparameter in die Vorschau.
- Das Vorschaubild (`opengraph-image.tsx`, 1200 × 630) und
  `twitter:card=summary_large_image` standen schon; sie sind das, was LinkedIn
  und Teams aus einem geteilten Link machen.
- Strukturierte Daten (`SoftwareApplication` auf der Startseite, dazu
  `FAQPage` auf der Preisseite) enthalten ausschliesslich, was auf der Seite
  auch sichtbar steht.

**Seit 04.09.2026 stehen echte Selbstbedienungspreise:** Starter 12&nbsp;€/Monat,
Professional 49&nbsp;€/Monat, in `messages/{de,en}.json` unter
`Pricing.tier*Price` und als eigenes `Offer` je Stufe im JSON-LD von
`app/[locale]/pricing/page.tsx`. Enterprise bleibt bei „Preis auf Anfrage" —
die einzige Stufe, die ein Verkaufsgespräch braucht.

Wichtig: Es gibt noch **keinen Checkout**. Der Knopf hinter Starter/Professional
führt weiterhin zum Kontaktformular (`ctaContact`, jetzt „Zugang anfragen"
statt „Angebot anfragen" — der Preis steht ja schon fest, nur die Freischaltung
ist noch manuell). Ein Stripe-Checkout, der den Tarif in
`organization_entitlements` automatisch setzt, ist der naechste Schritt, wenn
sich die Preise in der Praxis bestaetigen. Die Zahlen selbst sind ein
Vorschlag aus einer Erfahrungsregel (Selbstbedienungsschwelle in deutschen
Mittelstandsbetrieben, keine getestete Zahlungsbereitschaft) — siehe
`VSM Builder Wachstumskonzept`.

## Was bewusst fehlt

- **Double-Opt-in.** Das Formular speichert eine einfache Einwilligung mit
  Wortlaut. Wer daraus einen Newsletter machen will, braucht den
  Bestaetigungsschritt — und dafuer einen Mailversand, den es hier nicht gibt.
- **Mailversand ueberhaupt.** Der Verwaltungsbereich schreibt keine Mails; er
  zeigt Adressen an. Eine Vorlagenverwaltung ohne Versandweg waere ein
  Formular, das nichts tut.
- **Ein Spiegel von `auth.users`.** Braeuchte einen zweiten Trigger auf einer
  fremden Tabelle — genau die Konstellation, die am 16.08. die Registrierung
  aller drei Produkte lahmgelegt hat. Die Nutzerliste kommt deshalb aus der
  Admin-API.
- **Bezahlvorgang.** Tarife vergibt der Betreiber von Hand. Ein
  Zahlungsanbieter ist eine eigene Entscheidung mit eigenen Vertragsfragen.
- **Angaben zum Hosting auf der Preisseite.** Aus demselben Grund, aus dem sie
  auf der Startseite fehlen: Sie brauchen belastbare Angaben zu Standort,
  Unterauftragsverarbeitern und AVV. Eine Andeutung waere schlimmer als
  Schweigen.
