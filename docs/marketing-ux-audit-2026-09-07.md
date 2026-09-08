# Marketing- und Erlebnis-Audit — VSM Builder

**Datum:** 2026-09-07
**Gegenstand:** Der gesamte öffentliche Trichter — `/`, `/demo`, `/pricing`, `/signup`,
`/dashboard` (Leerzustand), `/data-sheet` — plus die Preis- und Tarifmechanik dahinter.
**Methode:** Codelektüre gegen zwei Brillen. Erstens die des B2B-Marketings
(Positionierung, Trichter, Kaufweg, Beweisführung). Zweitens die Denkwerkzeuge von
Tony Robbins, soweit sie überprüfbar sind: Zustandsänderung, die sechs menschlichen
Grundbedürfnisse, Hebel, Ankern, Risikoumkehr.
**Abgrenzung:** Frühere Audits (`ux-audit-2026-08-12.md`, `ux-audit-2026-08-16.md`)
haben Touch-Ziele, Kontraste und die Orientierung im Editor behandelt. Dieses Dokument
wiederholt das nicht. Es fragt eine andere Sache: **Warum meldet sich jemand an, und
warum bezahlt er.**

---

## Befund in einem Satz

Das Produkt ist handwerklich und sprachlich weit über dem, was in diesem Marktsegment
üblich ist — aber der Trichter **stellt die Frage nie im richtigen Moment**: Der
stärkste Verkaufshebel (die Demo) endet ohne Aufforderung, der stärkste Kaufimpuls
(der geänderte Wert) wird weggeworfen, und die beiden Tarife mit einem echten Preis
sind nur über ein Kontaktformular zu haben.

---

## Was bereits außergewöhnlich ist — und nicht angefasst werden darf

Damit die Kritik danach im richtigen Verhältnis steht:

1. **Die Sprache.** „Kein Zeichenprogramm mit VSM-Formen, sondern ein Rechenwerkzeug,
   das nebenbei ein normgerechtes Diagramm zeichnet." Das ist eine Positionierung in
   einem Satz, gegen einen benannten Wettbewerber-Typus, ohne ihn zu nennen. Die
   meisten SaaS-Startseiten schaffen das auf drei Bildschirmen nicht.
2. **Die Weigerung, Unbelegtes zu behaupten.** Kein Preis ohne Beschluss, kein AVV-Satz
   ohne AVV, keine Bewertungssterne im JSON-LD (`page.tsx:84–88`). Das ist der Grund,
   warum die Seite glaubwürdig ist — und es ist genau die Substanz, aus der sich der
   fehlende Beweis (→ A4) *ehrlich* bauen lässt.
3. **Der Leerzustand des Dashboards** (`dashboard/page.tsx:174–200`) mit dem
   Beispielprojekt als Primärhandlung, und der bewusste Verzicht auf denselben Knopf
   zweimal (`:157–160`). Das ist Aktivierungsdesign auf hohem Niveau.
4. **Die Preistabelle liest aus `plans.ts`**, derselben Datei, gegen die
   `createProject` prüft. Eine Preisseite, die nicht lügen *kann*.
5. **Der Erhebungsbogen.** Ein druckbarer Aufnahmebogen mit Messanleitung
   („von Teil zu Teil gestoppt, ohne Warten davor oder danach"). Das ist ein
   fertiges Marketing-Werkzeug, das nur niemand als solches einsetzt (→ A6).

---

# Teil A — Die Marketing-Sicht

## A1 · Der Höhepunkt ohne Frage *(schwerster Fund)*

**Beobachtung.** Der Kommentar in `demo/page.tsx:30–38` beschreibt die Demo korrekt als
den stärksten Verkaufshebel: „Ein Black Belt gibt seine Firmenadresse nicht heraus, um
herauszufinden, ob ein Werkzeug seine Symbolik beherrscht." Richtig. Und dann endet die
Seite bei `demo/page.tsx:78` mit `<DemoCanvas />` — und **danach kommt nichts**. Kein
Abschluss, keine Aufforderung, kein Fußbereich.

Die einzigen Handlungsangebote stehen in der Kopfzeile (`:59–64`) — also dort, wo sie
schon standen, **bevor** der Nutzer irgendetwas erlebt hat.

**Warum das teuer ist.** Der Moment, in dem jemand eine Zykluszeit von 4,2 auf 2,8
ändert und die Durchlaufzeit vor seinen Augen fällt, ist der einzige Moment im ganzen
Trichter, in dem sich sein Zustand ändert. Er ist der Höhepunkt. Danach passiert:
nichts. Er schließt den Tab.

Die Peak-End-Regel ist hier kein Marketing-Kniff, sondern eine Beschreibung des
Vorgangs: Erinnert wird der stärkste Augenblick und der letzte. Der stärkste ist
brillant gebaut. Der letzte ist ein leerer Bildschirmrand.

**Änderung.**

1. **Reaktiver Abschluss unter dem Canvas.** Ein Abschnitt, der erst erscheint, wenn
   der Nutzer tatsächlich etwas geändert hat, und der das *Ergebnis seiner eigenen
   Änderung* nennt:

   > **Sie haben die Durchlaufzeit von 18,4 auf 9,1 Tage gerechnet.**
   > Das ist Ihr erstes Szenario. Im Konto bleibt es erhalten — mit Investition,
   > Amortisation und dem PDF fürs Gremium.
   > [ Diesen Wertstrom übernehmen ] [ Erst weiterprobieren ]

   Die Zahlen sind aus dem Zustand vorhanden; es braucht nur den Vergleich zum
   Anfangszustand aus `buildDemoState()`.

2. **Statischer Abschluss für alle**, auch die Nur-Leser: derselbe Fußbereich wie auf
   der Startseite, mit Erhebungsbogen und Preisen. Eine Seite ohne Ausgang ist eine
   Sackgasse, auch für Suchmaschinen.

**Aufwand:** ein halber Tag. **Erwartete Wirkung:** der größte einzelne Hebel in diesem
Dokument.

---

## A2 · Der weggeworfene Aufwand

**Beobachtung.** `DemoCanvas.tsx:29–42` hält den Zustand in `useState`. Der Kommentar
verteidigt das ausdrücklich: „Ein Neuladen setzt die Demo zurück, und das ist
beabsichtigt: Ohne Konto gibt es keinen Ort, an dem die Änderungen jemandem gehören
würden." Und `messages/de.json`, `Demo.noticeBody`, sagt es dem Nutzer vorab.

**Die Begründung ist datenschutzrechtlich sauber und verkäuferisch falsch.** Sie ist
nur dann richtig, wenn „speichern" *auf dem Server* meint. Im Browser (`sessionStorage`)
gehören die Daten weiterhin niemandem außer dem Nutzer, verlassen das Gerät nicht und
brauchen keine Einwilligung — es ist derselbe Rechtsstand wie jetzt.

**Was verloren geht.** Wer zehn Minuten an einem Wertstrom gearbeitet hat, hat
investiert. Genau diese Investition ist der Grund, sich anzumelden — nicht die
Funktionsliste. Aktuell lautet die Botschaft am Ende der Demo faktisch: *„Alles, was
Sie gerade gebaut haben, ist gleich weg. Möchten Sie ein Konto anlegen?"* Das ist die
Reihenfolge falsch herum. Sie muss lauten: *„Alles, was Sie gerade gebaut haben,
behalten Sie — legen Sie ein Konto an."*

**Änderung.**

- Demo-Zustand in `sessionStorage` spiegeln.
- Der Hinweisbalken (`demo/page.tsx:71–76`) wechselt seinen Text, sobald etwas
  geändert wurde: von „Nichts wird gespeichert" zu **„Ihre Änderungen bleiben in
  diesem Browser-Tab. Bei Anmeldung übernehmen wir sie in Ihr Konto."**
- `/signup?from=demo` liest den Zustand und legt ihn nach erfolgreicher Registrierung
  als erstes Projekt an — statt des generischen Beispielprojekts.
- Die Signup-Seite bekommt in diesem Fall eine andere Unterzeile: **„Ihr Wertstrom
  ‚Dreherei Musterwerk' wird nach der Anmeldung übernommen."**

---

## A3 · Der Preis ist Selbstbedienung, der Kaufweg ist Großkunde *(größtes Umsatzleck)*

**Beobachtung.** Seit dem 04.09. stehen echte Beträge: Starter **12 €/Monat**,
Professional **49 €/Monat**. Sie stehen im JSON-LD als `Offer` mit `price: 12` und
`availability: InStock`. Und die Schaltfläche darunter, `pricing/page.tsx:180`:

```tsx
href={tier === 'FREE' ? '/signup' : '#kontakt'}
```

Alles außer Kostenlos führt in ein **Kontaktformular**. Bestätigt in der FAQ:
„Wie wechsle ich den Tarif? — *Über eine Anfrage an uns.*"

**Warum das nicht funktioniert.** Für 12 € im Monat füllt niemand ein Formular aus und
wartet auf einen Rückruf. Der Aufwand der Kaufhandlung ist größer als der Preis. Ein
Kontakt-Vertriebsweg rechnet sich ab etwa 5.000 € Jahreswert; hier stehen 144 €. Jeder
Interessent, der auf „Zugang anfragen" klickt, kostet Sie ab da Vertriebszeit, die der
Tarif nie einspielt — und die überwiegende Mehrheit klickt gar nicht erst.

Dazu kommt: Google zeigt aufgrund des `Offer` einen Preis im Suchergebnis an. Wer mit
Kaufabsicht darauf klickt und ein Formular findet, erlebt einen Bruch.

**Änderung.** Es gibt nur zwei stimmige Zustände, und der aktuelle ist keiner davon:

| | Preis sichtbar | Kaufweg |
|---|---|---|
| **Empfohlen** | 12 € / 49 € | Selbstbedienung (Stripe Checkout), sofort freigeschaltet |
| Alternative | „auf Anfrage" | Formular — dann aber auch kein `price` im JSON-LD |

Konkret für die empfohlene Variante:
- Starter und Professional bekommen **„Tarif buchen"** statt „Zugang anfragen".
- Nur **Enterprise** behält das Formular. Dort ist der Vertriebsweg richtig.
- Die FAQ-Antwort zum Tarifwechsel wird ersetzt: **„Im Konto unter Tarife, sofort
  wirksam. Monatlich kündbar."**
- `organization_entitlements` bekommt den Webhook-Weg, den die Admin-Vergabe heute von
  Hand geht — die Datenstruktur trägt das bereits.

---

## A4 · Kein einziger Beweis — und die ehrliche Alternative

**Beobachtung.** Auf keiner öffentlichen Seite steht ein Kundenname, ein Logo, ein
Zitat, eine Zahl über Nutzung, ein Fallbeispiel oder ein genannter Fachmann. Ich halte
das nicht für ein Versäumnis, sondern für die Konsequenz der Haltung aus A/Punkt 2:
Es gibt offenbar noch keine belegbaren Referenzen, und erfundene wären schlimmer als
keine. **Diese Entscheidung ist richtig und bleibt.**

Aber: Die ehrliche Alternative zu erfundenem Beweis ist nicht *kein* Beweis, sondern
**vorführbarer** Beweis. Davon liegt reichlich herum — nur nicht als Beweis
präsentiert, sondern als Fließtext verstreut:

| Vorhandene Tatsache | Heute | Als Beweis |
|---|---|---|
| Symbolik nach Rother/Shook | im Fließtext | **methodische Autorität** — der Name, der in dieser Zielgruppe Vertrauen trägt |
| 4 Kennzahlen mit offengelegtem Rechenweg | eigener Abschnitt ✓ | gut gelöst, bleibt |
| 24 Fachbegriffe im Kontext | eine von vier Kacheln | eigene Zahl, prominent |
| EU-Hosting, kein Tracking-Dienst | eigener Abschnitt ✓ | gut gelöst, bleibt |
| Methodikprüfung, die *widerspricht* | eigener Abschnitt ✓ | stärkster Abschnitt der Seite |
| Erhebungsbogen mit Messanleitung | Fußzeilen-Link | siehe A6 |

**Änderung.** Ein schmaler Beweisstreifen direkt unter dem Hero, vier Zahlen, keine
Prosa:

> **Symbolik nach Rother & Shook** · **4 Kennzahlen mit offenem Rechenweg** ·
> **24 Fachbegriffe erklärt** · **EU-Hosting, keine Tracker**

Das ist keine einzige unbelegte Behauptung, und es beantwortet in zwei Sekunden die
Frage „kennen die das Fach?" — die in dieser Zielgruppe vor jeder anderen kommt.

**Zusätzlich, sobald es zulässig ist:** Der erste namentliche Anwender ist mehr wert
als jede weitere Funktion. Bis dahin genügt eine anonymisierte Form, sofern sie stimmt
(„Ein Zulieferer der Automobilindustrie, 340 Mitarbeiter, …"). Nicht vorher.

---

## A5 · Kein Anker im Preis

**Beobachtung.** Die Tarifleiste heißt 0 € / 12 € / 49 € / auf Anfrage. Der Leser hat
keinen Vergleichsmaßstab, an dem 49 € günstig oder teuer wäre. Enterprise „auf
Anfrage" liefert auch keinen — ein fehlender Preis ankert nichts.

**Der Anker liegt bereit und wird nicht benutzt.** Die Alternative zum VSM Builder ist
nicht ein anderes Werkzeug. Sie ist:

- ein externer Lean-Berater für den Workshop (vier- bis fünfstellig), oder
- zwei Ingenieurstage in Excel, Visio und PowerPoint — mit Zahlen, die niemand
  nachrechnen kann.

Der Vergleichssatz auf der Preisseite gehört genau dorthin, sachlich und ohne
Übertreibung:

> Ein moderierter Wertstrom-Workshop mit externer Begleitung kostet ein Vielfaches
> eines Jahresbeitrags. Das Werkzeug ersetzt die Moderation nicht — aber die zwei Tage
> danach, in denen die Zahlen in Excel neu gerechnet werden.

Das ist ehrlich (es ersetzt den Berater nicht) und ankert trotzdem.

---

## A6 · Der Erhebungsbogen — bestes Material, schlechteste Platzierung

**Beobachtung.** `/data-sheet` ist ein druckbarer Aufnahmebogen mit einer
Messanleitung, die besser ist als das meiste, was in Lean-Schulungen ausgeteilt wird
(„Rüstzeit: Vom letzten guten Teil der alten Sorte bis zum ersten guten Teil der
neuen."). Er ist ungegattert — richtig — und trägt bereits einen Rückweg
(`footerWithUrl`).

Verlinkt ist er: **einmal, in der Fußzeile der Startseite.**

**Warum das schade ist.** Das ist im klassischen Industrie-B2B das
Standard-Einstiegsangebot: das nützliche Ding, das jemand mitnimmt und das den
Produktnamen an die Linie trägt. Dazu:

- „Erhebungsbogen Wertstromanalyse", „Vorlage Wertstromaufnahme", „VSM Datenblatt
  PDF" sind Suchanfragen mit klarer Absicht und nahezu ohne Wettbewerb. Es gibt dafür
  aktuell **keine eigene Landeseite mit erklärendem Text** — nur das Formular selbst.
- Ein Bogen an der Linie erzeugt in genau dem Moment Bedarf, in dem die Zahlen
  eingetragen werden müssen.

**Änderung.**
- Eigener Abschnitt auf der Startseite (zwischen „Workshop" und „Hosting"), mit
  Vorschaubild und der Messanleitung als Anreißer.
- In die Kopfzeilen-Navigation aufnehmen, nicht nur in die Fußzeile.
- Erklärender Text auf `/data-sheet` **oberhalb** des Bogens (auf dem Ausdruck per
  `print:hidden` ausgeblendet) — sonst hat die Seite für Suchmaschinen zu wenig Text,
  um für diese Anfragen zu ranken.
- Vom Dashboard aus verlinken. Wer ein Projekt anlegt, braucht als Nächstes Daten.

---

## A7 · Fünf Abschnitte ohne Ausgang

**Beobachtung.** Die Startseite bietet Handlungen im Hero (`page.tsx:145–153`) und
dann wieder ganz unten im Kontaktabschnitt (`:331–346`). Dazwischen liegen fünf
Abschnitte — Kennzahlen, Methodikprüfung, Vergleich, Workshop, Hosting — **ohne eine
einzige Verlinkung, die weiterführt.**

Wer beim Abschnitt „Das Werkzeug widerspricht" überzeugt ist (und das ist der stärkste
Abschnitt der Seite), muss vier weitere Abschnitte scrollen, um handeln zu können.

**Änderung.** Kein Knopfgewitter. Zwei textliche Verweise genügen, an den Stellen, an
denen der Abschnitt eine Frage offen lässt:

- Ende „Das Werkzeug widerspricht" → *„Alle Prüfungen in der Demo ansehen →"*
- Ende „Vom Ist-Zustand zum Business Case" → *„Szenariovergleich in der Demo öffnen →"*

Zusätzlich: Die Kopfzeile scrollt mit (`page.tsx:103`). Bei einer Seite über 4.000 px
ist ein `sticky` Kopf mit dem Primärknopf der billigste Conversion-Gewinn, den es gibt
— und der Editor-Audit vom 16.08. hat für den Editor dieselbe Empfehlung ausgesprochen.

---

## A8 · Was es kostet, nichts zu tun

**Beobachtung.** Die Seite beschreibt mit großer Präzision, **was das Werkzeug tut.**
Sie sagt an keiner Stelle, **was der Zustand ohne das Werkzeug kostet.**

Die Vergleichstabelle zeigt 18,4 → 9,1 Tage. Für einen Lean-Fachmann ist die Bedeutung
offensichtlich. Für den, der das Budget freigibt — und das ist die Person, die den
Business Case liest — ist sie es nicht. 9,3 Tage weniger Durchlaufzeit sind gebundenes
Umlaufkapital, das freiwird. Das ist die Übersetzung, die die Seite selbst verspricht
(„übersetzt die Lean-Kennzahlen in die Sprache, in der über Budgets entschieden wird")
— und dann nicht liefert.

**Änderung.** Eine Zeile in der Vergleichstabelle: **„Gebundenes Umlaufkapital —
1,4 Mio € → 0,7 Mio €"**, mit derselben Fußnote „Beispielwerte". `lib/vsm/capital.ts`
rechnet das bereits. Es ist die einzige Zeile der Tabelle, die ein Kaufmann ohne
Übersetzung versteht.

---

# Teil B — Die Robbins-Sicht

Vorbemerkung, damit dieser Teil brauchbar bleibt: Der Robbins-typische Ton — hohe
Emotion, große Versprechen, Dringlichkeit — wäre für dieses Produkt **Gift**. Die
Glaubwürdigkeit dieser Seite ruht auf Understatement, und ein Master Black Belt mit
dreißig Jahren Werkserfahrung riecht Verkaufsdruck sofort. Was übernommen wird, sind
die *Denkwerkzeuge*, nicht der Tonfall.

## B1 · Zustand: Wo ändert sich etwas im Nutzer?

Robbins' Kernthese, nüchtern formuliert: Entscheidungen fallen im Zustand und werden
danach begründet. Also: **An welcher Stelle des Trichters ändert sich der Zustand des
Nutzers?**

Antwort: an genau einer. In der Demo, wenn eine Zahl sich live bewegt. Das ist wenig —
aber es ist der richtige eine Punkt, und er ist hervorragend gebaut.

Die Folgerung ist deshalb nicht „mehr Emotion überall", sondern: **Alles im Trichter
sollte auf diesen einen Punkt hin- und von ihm wegführen.** Heute tut es das nicht:

- Der Hero führt hin (Primärknopf „Demo öffnen") — **richtig gewichtet.**
- Der Punkt selbst ist gebaut — **richtig.**
- Von ihm weg führt: nichts (→ A1). **Die Kette bricht am Höhepunkt ab.**

Die Reihenfolge A1 → A2 vor allem anderen folgt genau hieraus.

## B2 · Die sechs Grundbedürfnisse — das Produkt bedient eines meisterhaft und verkauft es nicht

Von den sechs (Sicherheit, Abwechslung, Bedeutung, Verbundenheit, Wachstum, Beitrag)
sind für diesen Käufer zwei relevant:

**Sicherheit** — bedient und verkauft. „Jede Zahl zeigt ihren Rechenweg", „Das Werkzeug
widerspricht", „Wo die Daten liegen". Drei Abschnitte, die nichts anderes tun, als
Unsicherheit abzubauen. Das ist gut gemacht und trifft.

**Bedeutung** — bedient, aber **nicht verkauft**. Das ist der Fund dieses Abschnitts.

Das Produkt weiß bereits ganz genau, worum es dem Käufer geht. Zwei Sätze im Code
verraten es:

> „Die Zahl, die im Lenkungsgremium die Diskussion auslöst." *(Wertschöpfungsanteil)*
> „Das Blatt, das mit ins Gremium geht." *(PDF-Export)*

Das sind die beiden besten Sätze auf der ganzen Seite. Sie handeln nicht vom Werkzeug,
sondern von **der Stellung des Nutzers im Raum**. Der Käufer ist Industrial Engineer
oder Green Belt. Sein eigentliches Anliegen ist nicht „ein Diagramm zeichnen". Es ist:
*mit Zahlen in den Lenkungsausschuss gehen, die halten* — und als der gelten, dessen
Zahlen halten.

Beide Sätze stehen als Randnotiz in einer Aufzählung. Die Überschriften darüber
sprechen weiterhin vom Werkzeug.

**Änderung.** Die Hero-Zeile darf beides tragen. Heute:

> **Wertstromanalyse, die rechnet.**

Stark, präzise, produktzentriert. Eine Alternative, die dieselbe Präzision hat und den
Nutzer statt das Werkzeug in den Mittelpunkt stellt:

> **Wertstromanalyse, die im Lenkungsausschuss standhält.**
> Symbolik nach Rother und Shook, Durchlaufzeit und Taktzeit live aus den Prozessdaten,
> Future-State-Szenarien mit Amortisation. Jede Zahl zeigt ihren Rechenweg — auch dann,
> wenn im Raum jemand nachrechnet.

Nicht ungeprüft ersetzen: Beides gegeneinander testen. Die bestehende Zeile ist gut
genug, dass die Ablösung sich beweisen muss.

## B3 · „Fortschritt ist Erfüllung" — der Aktivierungspfad ist unsichtbar

Robbins: Menschen bleiben dabei, wenn sie Fortschritt *sehen*. Nach der Anmeldung
findet sich der Nutzer im Dashboard mit einem Beispielprojekt und einem leeren
Eingabefeld. Er weiß nicht, was ein fertiger Wertstrom bei ihm bedeutet, wie weit er
ist, oder was der nächste Schritt wäre.

**Änderung.** Eine Fortschrittsleiste im Dashboard, aus Daten, die schon vorliegen —
kein neues Zustandsmodell:

> **Ihr erster Wertstrom — Schritt 2 von 4**
> ✓ Projekt angelegt · ✓ Prozesse erfasst · ○ Bestände eingetragen ·
> ○ Szenario gerechnet
> *Noch ohne Bestände: Die Durchlaufzeit lässt sich erst danach rechnen.*

Der vierte Schritt ist bewusst „Szenario gerechnet" — das ist der Punkt, an dem der
Nutzer den Wert erlebt hat, und zugleich der Punkt, an dem die kostenlose Stufe
(1 Szenario, `plans.ts:43–46`) endet. Aktivierung und Kaufmoment fallen zusammen.
Das ist gut gebaute Freemium-Mechanik, die heute nur nicht sichtbar gemacht wird.

## B4 · Hebel: das stärkste „Warum" wird nicht benannt

Robbins' Frage bei jeder Verhaltensänderung lautet: *Was ist der stärkste Grund?*

Die Seite argumentiert überwiegend mit **Genauigkeit** (Formeln, Methodik, Prüfungen).
Genauigkeit ist ein guter Grund, aber sie ist ein **Vermeidungsgrund** — sie schützt
davor, falsch zu liegen.

Der stärkere Grund liegt daneben und wird nur gestreift: **ein Verbesserungsprojekt
bekommt Geld.** Investition, Amortisation, Risiko stehen in der Vergleichstabelle. Aber
kein Satz auf der Seite sagt aus: *Dieses Werkzeug ist dafür da, dass Ihr Projekt
genehmigt wird.*

**Änderung.** Die Überschrift des Vergleichsabschnitts trägt das bereits fast — „Vom
Ist-Zustand zum Business Case". Der Einleitungssatz darunter sollte das Ziel benennen,
nicht die Mechanik:

> Am Ende einer Wertstromanalyse steht selten ein Diagramm, sondern eine Entscheidung
> über Geld. Der Szenariovergleich liefert die Seite, auf der diese Entscheidung
> getroffen wird: Investition, Amortisation, Risiko — neben den Lean-Kennzahlen, aus
> denen sie folgen.

## B5 · Risikoumkehr: fehlt vollständig

Für 12 € und 49 € im Monat gibt es auf der Preisseite keinen einzigen risikomindernden
Satz. Nicht genannt, obwohl vermutlich alles zutrifft:

- monatlich kündbar
- keine Kreditkarte für die kostenlose Stufe *(steht in der FAQ, nicht bei den Tarifen)*
- bestehende Wertströme bleiben bei Herabstufung lesbar *(steht in der FAQ)*
- keine Mindestlaufzeit, keine Einrichtungsgebühr

Zwei dieser Punkte stehen bereits in der FAQ — also **unterhalb** der Tarifkacheln,
sichtbar erst nach dem Scrollen an der Entscheidung vorbei. Sie gehören als kleine
Zeile **unter die Knöpfe**, dorthin, wo die Hand zögert:

> *Monatlich kündbar · keine Einrichtungsgebühr · Ihre Wertströme bleiben auch nach
> einem Wechsel lesbar*

Das ist Kopieren von unten nach oben, kein neuer Inhalt und keine neue Zusage.

---

# Teil C — Erlebnisfunde außerhalb des Trichters

| # | Fund | Ort | Wirkung |
|---|---|---|---|
| C1 | **Anmeldeseite ist eine Sackgasse.** Kein Verweis zurück auf die Seite, kein Logo-Link, kein Weg zur Demo. Wer hier zögert, hat nur die Zurück-Taste. | `signup/page.tsx:41–110` | Abbrüche ohne Wiedereinstieg |
| C2 | **Der Sprachumschalter steht am Ende des `<body>`** — nach dem Inhalt, außerhalb jeder Kopfzeile. Für die englische Fassung ist er praktisch unauffindbar. | `layout.tsx:95` | Die gesamte englische Version wird kaum erreicht |
| C3 | **`Signup.subtitle` ist die schwächste Zeile im Projekt:** „Beginnen Sie mit Ihrer ersten Wertstromanalyse." Generisch, an der Stelle mit der höchsten Abbruchquote. | `messages/de.json` | Kein Grund, das Formular zu Ende auszufüllen |
| C4 | **Kein Weg zurück ins Marketing aus dem Dashboard.** Kein Link auf Demo, Erhebungsbogen oder Startseite. | `dashboard/page.tsx:52–86` | Angemeldete Nutzer erfahren nie vom Erhebungsbogen |
| C5 | **`heroNote` und `Demo.noticeBody` sagen dasselbe** mit anderen Worten. Der Hero verschenkt eine Zeile an eine Erklärung, die auf der Zielseite ohnehin wiederholt wird. | `de.json`, `Home.heroNote` | Verschenkter Platz an der teuersten Stelle |
| C6 | **Der Tarifhinweis im Dashboard erscheint nur, wenn `plan && usage`.** Wer noch kein `organization_entitlements` hat, sieht keinen Tarif — und damit auch nie den Weg zu den Preisen. | `dashboard/page.tsx:120` | Stiller Ausfall des einzigen Upgrade-Wegs in der App |
| C7 | **Kein Fußbereich auf `/demo`, `/signup`, `/login`, `/dashboard`.** Impressum und Datenschutz sind von diesen Seiten aus nicht erreichbar — in Deutschland zusätzlich eine rechtliche Frage, nicht nur eine gestalterische. | mehrere | Rechtlich prüfen |

---

# Priorisierung

Sortiert nach Wirkung geteilt durch Aufwand. Die ersten drei zusammen sind
schätzungsweise zwei bis drei Tage Arbeit und betreffen die Stelle, an der aus
Interesse Umsatz wird.

| Rang | Maßnahme | Abschnitt | Aufwand | Wirkung |
|---|---|---|---|---|
| **1** | Abschluss unter der Demo, reagiert auf die eigene Änderung | A1 | ½ Tag | **sehr hoch** |
| **2** | Selbstbedienungskauf für Starter/Professional statt Formular | A3 | 1–2 Tage | **sehr hoch** (direkter Umsatz) |
| **3** | Demo-Zustand erhalten und ins Konto übernehmen | A2 | 1 Tag | **hoch** |
| 4 | Beweisstreifen unter dem Hero, aus vorhandenen Tatsachen | A4 | 1 Std | hoch |
| 5 | Risikoumkehr-Zeile unter den Tarifknöpfen | B5 | 20 Min | hoch |
| 6 | Sprachumschalter in die Kopfzeile | C2 | 1 Std | hoch (für `/en` existenziell) |
| 7 | Fußbereich auf allen Seiten (inkl. Impressum) | C7 | 2 Std | hoch (rechtlich) |
| 8 | Anmeldeseite: Rückweg + Wertversprechen | C1, C3 | 1 Std | mittel |
| 9 | Erhebungsbogen als Einstiegsangebot ausbauen | A6 | ½ Tag | mittel, wächst über Zeit |
| 10 | Zwei Textverweise in den mittleren Abschnitten + `sticky` Kopf | A7 | 2 Std | mittel |
| 11 | Umlaufkapital-Zeile in der Vergleichstabelle | A8 | 1 Std | mittel |
| 12 | Fortschrittsanzeige im Dashboard | B3 | 1 Tag | mittel (Bindung) |
| 13 | Preisanker gegen Beraterkosten | A5 | 30 Min | mittel |
| 14 | Hero-Zeile gegeneinander testen | B2 | — | offen, nur mit Messung |

---

# Was nicht geändert werden sollte

Damit dieses Dokument nicht als Freibrief gelesen wird:

- **Keine erfundenen Referenzen, keine Bewertungssterne, keine Nutzerzahlen ohne
  Beleg.** Die Haltung aus `page.tsx:84–88` ist der Grund, warum die Seite trägt.
- **Kein Dringlichkeitsdruck.** Keine Countdown-Angebote, kein „nur noch heute", keine
  Popup-Schicht. Die Zielgruppe entscheidet in Wochen, nicht in Minuten, und jedes
  dieser Mittel kostet mehr Vertrauen, als es an Abschlüssen bringt.
- **Der nüchterne Ton bleibt.** Alle Textvorschläge oben sind bewusst im vorhandenen
  Register geschrieben.
- **Die Demo bleibt ohne Anmeldung und ohne Serverzustand.** A2 schlägt
  `sessionStorage` vor — im Browser des Nutzers, nicht in der Datenbank. Die
  Entscheidung von `demo/page.tsx:30–38` bleibt damit unangetastet.
- **Der Leerzustand des Dashboards bleibt, wie er ist.** Er ist richtig gelöst.
