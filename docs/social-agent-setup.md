# Social-Media-Agent: Einrichtung

Stand 2026-09-28. Der Agent läuft auch **ohne** LinkedIn- und Instagram-Anbindung,
nämlich im Handbetrieb: Er entwirft, du gibst frei, kopierst den Text,
postest selbst und trägst die Zahlen ein. Die API-Anbindung ist die zweite
Stufe, weil ihre Freigaben dauern (LinkedIn: Tage bis Wochen). Die Reihenfolge
unten ist so gewählt, dass nach Schritt 3 schon echte Daten entstehen.

## Wie es läuft

| Wann | Was | Wo |
|---|---|---|
| Freitag, 07:05 UTC | Auswertung → neues Regelwerk, dann Entwürfe für die nächste Woche | `api/social/cron` |
| Wochenende / Montag | Du prüfst, änderst, gibst frei (≈ 10 Min.) | `/admin/social/queue` |
| Täglich, 07:05 UTC | Freigegebenes, dessen Tag gekommen ist, wird gepostet; Messwerte nach 24 h / 72 h / 7 T. abgeholt | `api/social/cron` |
| Jederzeit | Was funktioniert, Regelwerk, Themenbilanz | `/admin/social` |

Plan: LinkedIn Di/Mi/Do, Instagram Mo/Mi/Fr (`src/lib/social/config.ts`,
`WEEKLY_SCHEDULE`). Themen, Formate und die Markenstimme stehen in derselben
Datei.

---

## 1. Konten anlegen (einmalig, von Hand)

Konten kann niemand stellvertretend für dich anlegen: Beide Plattformen verlangen
eine echte Person mit Telefon-/E-Mail-Bestätigung, und bei LinkedIn hängt die
Unternehmensseite an deinem persönlichen Profil.

### LinkedIn-Unternehmensseite

1. Mit deinem persönlichen LinkedIn-Profil anmelden (ohne persönliches Profil
   gibt es keine Unternehmensseite).
2. Oben rechts **Für Unternehmen** → **Unternehmensseite erstellen** → **Unternehmen**.
3. Name `Taktane`, URL `linkedin.com/company/taktane` (falls frei), Website
   `https://taktane.com`, Branche *Softwareentwicklung*, Grösse *0–1* bzw.
   passend, Typ *Privatunternehmen*.
4. Logo (quadratisch, mind. 300 × 300) und Slogan („Wertstromanalyse, die rechnet.“).
5. Titelbild 1128 × 191.

Tipp für Reichweite: Auf LinkedIn erreichen persönliche Profile meist ein
Vielfaches einer frischen Unternehmensseite. Wenn du die Texte auch von deinem
Profil aus teilst (oder direkt dort postest), bringt das am meisten. Der Agent
kann beides (siehe `LINKEDIN_AUTHOR_URN` unten); Messwerte gibt die API aber
nur für Unternehmensseiten her.

### Instagram-Business-Konto

1. Instagram-App → neues Konto `taktane` (eigene E-Mail-Adresse, z. B. social@taktane.com).
2. **Einstellungen → Kontotyp und Tools → Zu professionellem Konto wechseln →
   Unternehmen**, Kategorie *Software*.
3. Eine **Facebook-Seite** „Taktane“ anlegen (facebook.com/pages/create) und in
   Instagram unter **Einstellungen → Kontenübersicht (Meta Accounts Center)**
   bzw. **Profil bearbeiten → Seite** mit dem Instagram-Konto verknüpfen.
   Ohne verknüpfte Facebook-Seite gibt es keinen API-Zugang auf diesem Weg.
4. Profilbild = Logo, Bio z. B. „Wertstromanalyse, die rechnet. Kostenlos testen ↓“,
   Link `https://taktane.com`.

---

## 2. Zugangsdaten für den Agenten (Vercel → Settings → Environment Variables)

Nie in eine Datei im Repository, nie in einen Chat.

| Variable | Wofür | Woher |
|---|---|---|
| `ANTHROPIC_API_KEY` | Entwürfe und Auswertung | console.anthropic.com → API Keys |
| `CRON_SECRET` | Schutz des täglichen Laufs | selbst erzeugen: `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | ist schon gesetzt (Interessenten) | – |
| `NEXT_PUBLIC_SITE_URL` | ist schon gesetzt; muss die echte Domain sein, weil Instagram die Kachel von dort abholt | – |

Danach die Migration einspielen
(`supabase/migrations/20260928145926_vsm_social_agent.sql`) und neu
ausliefern. Unter **Verwaltung → Social Media** sollten Claude und der tägliche
Lauf grün sein, beide Kanäle „Handbetrieb“.

## 3. Loslegen im Handbetrieb

1. `/admin/social` → **Entwürfe für nächste Woche erzeugen**.
2. `/admin/social/queue` → prüfen, anpassen, **Freigeben**.
3. Am geplanten Tag: Text kopieren, Kachel anklicken → speichern, auf der
   Plattform posten, Adresse eintragen → **Als gepostet markieren**.
4. Nach ~3 und ~7 Tagen: Zahlen aus der Plattform-Statistik abtippen
   (**Messwerte eintragen**). Pflicht ist nur Impressionen/Views oder Reichweite.

Ab 4 ausgewerteten Beiträgen (72 h alt) schreibt die Freitagsauswertung das
erste Regelwerk.

---

## 4. LinkedIn automatisch

1. developer.linkedin.com → **Create app**. Als *LinkedIn Page* die
   Taktane-Seite angeben, Logo hochladen. Die Seite muss die App danach
   bestätigen (Link unter *Settings → Verify*).
2. Reiter **Products**:
   - **Community Management API** beantragen → nötig für Posten *als
     Unternehmensseite* und für die Statistiken. Wird geprüft (Formular zu
     Unternehmen und Verwendungszweck; „Veröffentlichen eigener Inhalte auf
     der eigenen Unternehmensseite und Auswertung der Beitragsstatistik“).
   - Solange die Freigabe fehlt: **Share on LinkedIn** (sofort verfügbar)
     erlaubt Posten *von deinem persönlichen Profil*, aber ohne Statistiken.
3. Token erzeugen: **Docs and tools → OAuth Token Tools → Create token**,
   Scopes `w_organization_social r_organization_social rw_organization_admin`
   (bzw. `w_member_social openid profile` für das persönliche Profil).
4. In Vercel setzen:
   - `LINKEDIN_ACCESS_TOKEN` — das Token
   - `LINKEDIN_AUTHOR_URN` — `urn:li:organization:<ID>`; die ID steht in der
     Adresse der Seitenverwaltung (`linkedin.com/company/<ID>/admin/`).
     Für das persönliche Profil `urn:li:person:<ID>` (aus
     `GET https://api.linkedin.com/v2/userinfo`, Feld `sub`).
   - optional `LINKEDIN_API_VERSION` (Vorgabe `202608`, Format `JJJJMM`)

**Achtung, Ablauf:** LinkedIn-Tokens gelten 60 Tage. Danach scheitert das
Posten mit 401; der Beitrag landet mit Fehlermeldung wieder in der
Warteschlange. Token neu erzeugen, in Vercel ersetzen. (Automatisches
Erneuern gibt LinkedIn nur freigegebenen Marketing-Partnern.)

## 5. Instagram automatisch

1. developers.facebook.com → **Meine Apps → App erstellen** → Anwendungsfall
   „Anderes“ → Typ **Business**. Dein Facebook-Konto muss Admin der
   Taktane-Facebook-Seite sein.
2. Produkt **Instagram** (Instagram API mit Facebook-Login) hinzufügen.
3. **Graph API Explorer** (developers.facebook.com/tools/explorer): deine App
   wählen, Berechtigungen `instagram_basic`, `instagram_content_publish`,
   `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`,
   `business_management` → **Generate Access Token**.
   Im Entwicklungsmodus der App reicht das für Konten, die du selbst
   verwaltest — eine App-Prüfung durch Meta ist dafür nicht nötig.
4. Dauerhaftes Seiten-Token ableiten (das kurzlebige läuft nach einer Stunde ab):
   - Im **Access Token Debugger** das Token auf „Extend“ → langlebiges
     Nutzer-Token (60 Tage).
   - Mit diesem im Explorer `GET /me/accounts` → beim Eintrag der
     Taktane-Seite steht `access_token`. Dieses **Seiten-Token läuft nicht ab**.
5. Instagram-Konto-ID: im Explorer mit dem Seiten-Token
   `GET /<seiten-id>?fields=instagram_business_account` → `id`.
6. In Vercel setzen:
   - `INSTAGRAM_ACCESS_TOKEN` — das Seiten-Token
   - `INSTAGRAM_USER_ID` — die ID aus Schritt 5
   - optional `INSTAGRAM_GRAPH_VERSION` (Vorgabe `v23.0`)

Instagram lädt die Kachel selbst von `https://<deine-domain>/api/social/card/<id>`.
Lokal (localhost) kann das Posten auf Instagram deshalb nicht funktionieren.

---

## 6. Echte Fotos statt einfarbiger Kachel (optional)

Ohne weiteren Schlüssel bekommt jede Kachel eine einfarbige Fläche als
Hintergrund. Mit einem OpenAI-Schlüssel wird daraus ein echtes,
themenpassendes Foto (Andon-Tafel, Kanban-Karte, handgezeichnetes
Wertstromdiagramm — je nach Thema, siehe `TOPIC_PHOTOS` in
`src/lib/social/config.ts`), bewusst im Stil einer Wirtschaftsreportage
(leichte Körnung, echtes Licht, keine Hochglanz-Werbeoptik) statt eines
glatten Stockfotos — das ist es, woran sich ein Produktionsleiter eher
wiedererkennt als an einer generischen Fabrikhalle.

1. platform.openai.com → Konto anlegen, unter **Billing** ein kleines
   Guthaben aufladen (5–10 $ reichen für Monate: ca. 15–25 Rappen je Bild
   in hoher Qualität, und jedes Bild entsteht nur **einmal pro Beitrag**,
   nicht bei jedem Abruf).
2. **API Keys → Create new secret key**, kopieren.
3. In Vercel: `OPENAI_API_KEY` setzen.

Schlägt die Erzeugung fehl (kein Guthaben, Dienst nicht erreichbar), bleibt
die Kachel automatisch einfarbig — kein Beitrag scheitert daran. Das Foto
wird in `vsm_social_posts.card_photo_base64` zwischengespeichert; ein
Entwurf, der neu erzeugt wird, hat noch kein Foto und bekommt beim ersten
Kachel-Abruf eines.

---

## Was noch ungeprüft ist

Die beiden Plattform-Anbindungen (`src/lib/social/publishers.ts`) sind nach
den öffentlichen APIs gebaut, konnten aber ohne Zugangsdaten nicht gegen die
echten Plattformen getestet werden. Beim ersten echten Beitrag je Kanal: im
Verwaltungsbereich **Jetzt posten** drücken und die Fehlermeldung ansehen,
falls eine kommt. Die häufigsten Ursachen:

- `version not supported` → `LINKEDIN_API_VERSION` bzw.
  `INSTAGRAM_GRAPH_VERSION` auf eine aktuelle Version setzen.
- 401/403 → Token abgelaufen oder Berechtigung fehlt.
- Instagram „media download failed“ → `NEXT_PUBLIC_SITE_URL` zeigt nicht auf
  die öffentliche Domain.

Automatisch geliked, kommentiert oder gefolgt wird bewusst nicht: Das
verstösst gegen die Nutzungsbedingungen beider Plattformen und riskiert eine
Sperre. Auf Kommentare selbst antworten bringt ohnehin die meiste Reichweite.
