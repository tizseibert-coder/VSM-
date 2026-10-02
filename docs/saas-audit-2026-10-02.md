# SaaS-Must-have-Audit Taktane — 02.10.2026

Geprüft: Backup, Schnittstellen, Datenschutz/Recht, Sicherheit und Betrieb.
Grundlage: Code auf `master` (3b98eb7), Live-Datenbank `vsm-builder-prod` (Supabase-Advisors, Katalog, Logs der letzten 24 h),
`npm audit`, Tests, Lint und Build. Die Live-Website war aus der Prüfumgebung nicht erreichbar; die
HTTP-Header sind deshalb aus dem Code abgeleitet.

## Ergebnis auf einen Blick

| Prüfung | Ergebnis |
|---|---|
| Tests (`vitest`) | 497/497 grün |
| Lint | 0 Fehler, 2 Warnungen (unnötige `eslint-disable` in `opengraph-image.tsx`) |
| Build | grün (vorher und nach dem Next-Update) |
| `npm audit` (Produktion) | **1 kritisch, 1 niedrig**, nach Update auf Next 16.3.8: 0 |
| RLS in Produktion | alle `public`-Tabellen mit RLS, keine ohne |
| Backups | **keine**, das Supabase-Projekt läuft im Free-Plan |
| Schema Produktion ↔ Repo | **weicht ab**, CAMA-Migrationen fehlen live |

## P0: sofort

### 1. Next.js 16.3.0 hat eine kritische RCE-Lücke (behoben, nicht committet)
GHSA-vcvr-r3jv-pc5j (RCE in `next/og` `ImageResponse`) und GHSA-2xp9-vwfh-vxw4 (Bildoptimierung/AVIF).
Taktane nutzt `ImageResponse` in der **öffentlichen, nicht angemeldeten** Route
`/api/social/card/[postId]` und in `opengraph-image.tsx`.
**Fix:** `next` und `eslint-config-next` auf 16.3.8 gehoben (exakt gepinnt wie bisher), `dompurify` per
Lockfile auf 3.4.16. Tests, Lint und Build sind damit grün. Liegt im Arbeitsbaum und muss nur noch
deployt werden.

### 2. Es gibt keine Backups
Die Supabase-Organisation „LeanPulse Industrial" steht auf `plan: free`. Der Free-Plan hat keine
abrufbaren täglichen Backups und keine Point-in-Time-Recovery. Inaktive Projekte werden pausiert.
In der Datenbank liegen 4 Organisationen, 5 Wertströme, 5 Leads und 2 Stripe-Kunden, außerdem
die Daten der beiden Schwesterprodukte. Ein falsches `DELETE`, ein `prisma migrate dev` (siehe
`supabase/README.md`, Regel 3) oder ein Supabase-Vorfall wäre heute endgültig.
**Maßnahmen:**
1. Auf Supabase Pro wechseln: tägliche Backups mit 7 Tagen Aufbewahrung. PITR als Add-on, sobald zahlende Kunden darauf arbeiten.
2. Zusätzlich ein eigenes Backup außerhalb von Supabase: nächtlicher `pg_dump` (GitHub Action oder Cron), verschlüsselt (age/GPG) in einen Speicher in CH/EU, z. B. 30 Tage täglich und 12 Monate monatlich. Logos stecken in `vsm_org_settings` und sind damit automatisch dabei.
3. Den Restore einmal pro Quartal in ein Wegwerfprojekt testen. `supabase/tests/leere-datenbank-pruefen.sh` ist dafür schon die halbe Miete. Ein Backup ohne getesteten Restore zählt nicht.
4. RPO/RTO in AGB oder AVV und in den TOMs festhalten (z. B. RPO 24 h, RTO 1 Arbeitstag).

### 3. Das Live-Schema hinkt dem Code hinterher, und Funktionen sind in Produktion kaputt
In `supabase_migrations.schema_migrations` fehlen
`20260914150000_vsm_cama_capacity_analysis` und `20260917200000_vsm_cama_actual_hours`.
`production_lines`, `line_capacity`, `capacity_actions`, `processes.line_id` und
`vsm_org_settings.capacity_*` gibt es live nicht. Die Postgres- und Edge-Logs der letzten 24 h
bestätigen das: `column vsm_org_settings.capacity_workdays does not exist`, `404 /rest/v1/production_lines`.
Folgen für Kunden:
- **Firmenprofil speichern schlägt immer fehl**, weil `saveOrgProfile` immer `capacity_workdays` schreibt.
- `loadOrgProfile` scheitert am Select und fällt auf ein leeres Profil zurück. **Logo, Markenfarbe und Firmenname fehlen** in Kopfleiste, PDF und Einladungen.
- **Demo-Übernahme schlägt fehl**, weil `demoTransfer` `line_id: null` einfügt.
- `/capacity` und die Kapazitätsansicht im Editor funktionieren nicht.

Dazu kommt Drift in die andere Richtung, entgegen den Regeln 4 und 5 aus `supabase/README.md`:
- `20260930153320_vsm_social_card_photo_error` ist live, hat aber **keine Datei im Repo**.
- `vsm_social_agent` und `vsm_social_card_photo` sind live als `20260928145926` / `20260928151810` verzeichnet, im Repo heißen sie `20260928120000` / `20260929090000`.

**Fix:** die beiden CAMA-Migrationen einspielen (idempotent geschrieben, aber eine Live-Änderung, deshalb mit Freigabe), die fehlende Datei mit dem Live-Namen nachziehen und die beiden Dateien umbenennen. Gegen Wiederholung hilft ein CI-Check, der die Dateinamen in `supabase/migrations/` mit `schema_migrations` vergleicht, sowie die Reihenfolge „erst migrieren, dann mergen".

## P1: diese Woche

### 4. Keine Selbstbedienung für Löschen und Datenexport
- Es gibt keinen Weg, das eigene **Konto oder die Organisation zu löschen**. Im Code steht kein `auth.admin.deleteUser`. Die Rechte nach Art. 17 DSGVO bzw. Art. 32 DSG laufen nur per E-Mail.
- Es gibt **keinen maschinenlesbaren Export**, nur PDF. Die Datenschutzerklärung verspricht „Herausgabe in einem gängigen Format" (Art. 20 DSGVO). Für B2B-Kunden ist ein Export außerdem die Exit-Voraussetzung.

**Vorschlag:**
- Unter `/settings` „Daten exportieren" (JSON und CSV je Wertstrom und für die ganze Organisation) einbauen.
- „Konto löschen" einbauen, mit Bestätigung. Ablauf: Stripe-Abo kündigen, bei alleinigem Owner die Org-Daten löschen (die Kaskaden sind vorhanden), dann `auth.admin.deleteUser`. Über `requireUser` und den Service-Role-Client, analog zu `requireAdmin`.

### 5. Security-Header fehlen
`next.config.ts` hat kein `headers()`. Es fehlen CSP, HSTS, `X-Frame-Options`/`frame-ancestors`
(Clickjacking auf Login und Einstellungen), `Referrer-Policy` und `Permissions-Policy`. Nur die Logo-Route
setzt eigene Header.
**Fix:** `headers()` in `next.config.ts`. Zuerst die CSP als `Content-Security-Policy-Report-Only`, weil Konva, Stripe-Redirect und Google OAuth mitspielen müssen.

### 6. Funde der Supabase-Sicherheitsadvisors
- `is_vsm_staff()`, `is_vsm_admin()` und `project_org_id()` sind `SECURITY DEFINER` und für **`anon`** per RPC aufrufbar. Wer eine Projekt-UUID kennt, bekommt über `project_org_id` ohne Anmeldung die Org-ID.
  **Fix:** `REVOKE EXECUTE ... FROM anon, public` für die Taktane-eigenen Funktionen (auch `line_org_id`). `has_org_role` und `accept_invitation` gehören Prisma und sind dort zu klären.
- **Leaked-Password-Protection** (HaveIBeenPwned) ist aus. Sie gibt es erst ab Pro, ein weiterer Grund für Punkt 2.
- Die Mindestpasswortlänge 8 ist nur in der Server-Action geprüft. Dieselbe Regel gehört in die Supabase-Auth-Einstellungen, sonst lässt sie sich direkt über die Auth-API umgehen.

### 7. Datenschutzerklärung aktualisieren (Stand 19.09.)
- **Social-Media-Präsenzen fehlen.** Seit dem 28.09. postet Taktane auf LinkedIn und Instagram. Für Seiten-Statistiken gilt nach EuGH gemeinsame Verantwortlichkeit mit LinkedIn bzw. Meta (Art. 26 DSGVO). Dafür braucht es einen eigenen Abschnitt mit Link auf die Vereinbarungen der Plattformen.
- **Drittlandübermittlung vollständig nennen.** Supabase Inc. und Vercel Inc. sind US-Unternehmen. Trotz Hosting in Frankfurt ist ein Zugriff aus den USA möglich (Support, Logs). Das revDSG (Art. 16/19) verlangt, die Staaten und die Garantien zu nennen: Swiss-U.S. bzw. EU-U.S. Data Privacy Framework oder Standardvertragsklauseln. Heute steht das nur bei Stripe und Google.
- **E-Mail-Versand nennen.** Über welchen Dienst gehen die Auth-Mails? Wenn das Supabase-Standard-SMTP ist, siehe Punkt 13.
- **„Dateispeicher" bei Supabase streichen.** Es gibt keinen Storage-Bucket, Logos liegen in der Datenbank.
- **Löschfrist für Leads konkret machen** (z. B. 24 Monate nach letztem Kontakt) und technisch umsetzen. „Bis der Zweck entfällt" ist zu vage.
- Anthropic und OpenAI verarbeiten heute keine personenbezogenen Daten (Social-Agent, Stichprobe in `lib/social/agent.ts`). Deshalb kein Pflichteintrag, aber intern festhalten: Sobald Lead- oder Kundendaten in Prompts landen, müssen beide in die Liste der Auftragsverarbeiter.
- `LAST_UPDATED` in `datenschutz/page.tsx` nachführen und `en.json` mitziehen.

### 8. Die Cookie-Einwilligung lässt sich nicht widerrufen
Nach „Akzeptieren" verschwindet der Banner, und **es gibt keinen Link, um die Entscheidung zu ändern**.
Art. 7 Abs. 3 DSGVO verlangt, dass der Widerruf so einfach ist wie die Erteilung. Die Datenschutzerklärung
verspricht genau das.
**Fix:** einen Footer-Link „Cookie-Einstellungen" einbauen, der `vsm_consent` löscht bzw. den Banner wieder öffnet. Bei Widerruf auch `vsm_attr` löschen.

### 9. AVV, TOMs und Liste der Unterauftragsverarbeiter nur auf Anfrage
Für B2B-SaaS sind das Pflichtunterlagen, und Einkäufer fragen danach, bevor sie unterschreiben.
**Vorschlag:** `/avv` mit AVV (DSG und DSGVO), TOMs (Verschlüsselung, RLS, Backups aus Punkt 2, Zugriffskonzept über `vsm_staff`) und Liste der Unterauftragsverarbeiter (Supabase, Vercel, Stripe, Google; E-Mail-Dienst) mit Ankündigungsfrist bei Änderungen.

## P2: nächste Iteration

### 10. Stripe-Webhook verarbeitet veraltete und doppelte Ereignisse
`customer.subscription.updated` entscheidet anhand des Abo-Stands **im Ereignis**. Stripe sagt keine
Reihenfolge zu, und Wiederholungen kommen Tage später. Ein verspätetes `updated (active)` nach `deleted`
vergibt den Tarif wieder. Es gibt auch kein Protokoll der Event-IDs.
**Fix:** im Handler das Abo per `stripe.subscriptions.retrieve(id)` frisch holen und nur danach entscheiden. Optional `event.id` in einer Tabelle speichern, um Duplikate zu erkennen. Ausgewertet wird außerdem nur `items.data[0]`; für Add-ons später relevant.

### 11. Schnittstellen im Einzelnen
| Schnittstelle | Auth | Befund |
|---|---|---|
| `POST /api/webhooks/stripe` | Signatur über Rohtext | gut; siehe Punkt 10 |
| `GET /api/social/cron` | `Bearer CRON_SECRET` | ok; Vergleich nicht zeitkonstant (`timingSafeEqual`), niedrig |
| `GET /api/social/card/[postId]` | öffentlich, UUID | ok; erzeugt beim ersten Aufruf ein kostenpflichtiges OpenAI-Bild. Wer eine Post-UUID kennt, kann bis zu 120 s Laufzeit auslösen, aber nur einmal je Post, das Ergebnis wird gecacht. RCE siehe Punkt 1 |
| `GET /api/org-logo/[id]` | Session + RLS | vorbildlich (404 statt 403, `sandbox`-CSP, `nosniff`, `private`-Cache) |
| `/auth/callback` | OAuth | `safeNextPath` getestet, gut |
| LinkedIn/Instagram | Tokens in Env | LinkedIn-Token läuft nach 60 Tagen ab. Bisher fällt der Kanal nur still in den Handbetrieb; besser mit Erinnerung oder Alarm |

Eine öffentliche Kunden-API gibt es nicht. Für die Zielgruppe ist das heute kein Muss; CSV-Import ist vorhanden.

### 12. Kein Rate-Limiting
Das Lead-Formular hat Honeypot und Einwilligung, gut. Login, Registrierung und Lead-Formular haben
aber kein Rate-Limit über die Supabase-Vorgaben hinaus.
**Vorschlag:** eine Vercel-WAF-Regel oder Cloudflare Turnstile auf Lead-Formular und Registrierung.

### 13. Auth-E-Mails: SMTP prüfen
Ob ein eigener SMTP-Dienst eingerichtet ist, ließ sich mit den verfügbaren Werkzeugen nicht prüfen. Das
Supabase-Standard-SMTP ist auf wenige Mails pro Stunde begrenzt und nicht für den Produktivbetrieb
gedacht. Ohne eigenen SMTP-Dienst bleiben Bestätigungsmails bei mehreren Registrierungen hängen.
Wenn eingerichtet, gehört der Dienst in die Datenschutzerklärung.

### 14. Monitoring, Alerting und CI fehlen
Es gibt kein `.github/workflows`, kein Sentry und kein Uptime-Monitoring; Fehler landen nur in
`console.error`. Die Schema-Drift aus Punkt 3 ist genau deshalb niemandem aufgefallen, so wie der
Vorfall vom 16.08.
**Vorschlag:** eine CI für Lint, Test, Build und den Migrations-Drift-Check, Sentry oder Vercel Monitoring
mit Alarm auf 5xx am Stripe-Webhook, und ein Uptime-Check auf `/de`.

### 15. AGB-Lücken
- Es fehlt eine Regelung zu **Datenrückgabe und Löschung nach Vertragsende**, z. B. 30 Tage Exportfrist, danach Löschung und Löschung in den Backups nach Ablauf der Aufbewahrung.
- „Export als PDF" ist als Datenportabilität zu schwach; nach Punkt 4 anpassen.
- Abgerechnet wird auch in EUR an EU-Kunden. Ist das Angebot **nur für Unternehmer**, sollte das ausdrücklich in den AGB stehen. Sonst fehlen Widerrufsbelehrung und Button-Lösung für EU-Verbraucher.
- Unterauftragsverarbeiter, AVV und Backup-Zusagen (Punkte 2 und 9) referenzieren.

### 16. Performance-Advisors (Taktane-eigene Tabellen)
- `auth.uid()` ohne `(select …)` in drei Policies: `activity_logs`, `vsm_staff`, `vsm_lead_events`.
- Je Tabelle wirken zwei permissive SELECT-Policies (`FOR ALL` plus `FOR SELECT`). Das ist funktional korrekt, kostet aber Leistung. Besser: Schreib-Policies auf `INSERT`/`UPDATE`/`DELETE` aufteilen.
- Fremdschlüssel ohne Index: `inventory_buffers.from_process_id`/`to_process_id`, `scenarios.parent_scenario_id`, `activity_logs.project_id`.

Bei der heutigen Datenmenge (17 MB) eilt nichts davon.

### 17. Kleinkram
- Dev-Abhängigkeiten: `vitest` ≤ 4.1.10 (moderat, nur lokal relevant) lässt sich per `npm audit fix` beheben.
- Zwei unnötige `eslint-disable` in `opengraph-image.tsx`.

## Was schon gut ist
- RLS auf allen Tabellen. Der Service-Role-Client ist nur serverseitig nutzbar, mit Browser-Sperre, und wird vor jeder Nutzung über `requireStaff`/`requireAdmin` abgesichert.
- Der Stripe-Webhook prüft die Signatur über den Rohtext und antwortet bei Fehlern mit 500, damit Stripe neu zustellt. Dazu kommt der Rückfall über die Kunden-Metadaten.
- Das Attributions-Cookie wird nur nach Einwilligung gesetzt, ist `httpOnly` und wird nur von Taktane selbst gesetzt.
- Datenhaltung in Frankfurt (DB `eu-central-1`, Vercel `fra1`), dokumentiert.
- Einladungstoken nur als Hash, die Logo-Auslieferung unter RLS.
- 497 Tests auf der Fachlogik.

## Empfohlene Reihenfolge
1. Next 16.3.8 deployen (vorbereitet).
2. Supabase Pro, dann CAMA-Migrationen einspielen und Repo-Dateinamen angleichen.
3. Eigenes `pg_dump`-Backup und ein Restore-Test.
4. `REVOKE EXECUTE` von `anon` und Security-Header.
5. Cookie-Widerruf und Datenschutzerklärung (Social Media, USA, E-Mail-Dienst, Lead-Frist).
6. Export und Kontolöschung, AVV-Seite, AGB-Ergänzungen.
7. CI mit Drift-Check, Monitoring, Stripe-Webhook mit frischem Abruf.
