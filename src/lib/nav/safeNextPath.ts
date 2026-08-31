/**
 * Prueft einen `next`-Parameter, bevor er in ein redirect() geht.
 *
 * Ohne diese Pruefung waere `/login?next=https://phishing.example` eine offene
 * Weiterleitung: das Opfer meldet sich bei der *echten* Anwendung an — sieht
 * also die richtige Domain und das richtige Zertifikat — und wird danach auf
 * die fremde Seite geschickt. Genau darauf baut Phishing.
 *
 * Erlaubt ist deshalb ausschliesslich ein Pfad innerhalb dieser Anwendung.
 * Alles andere gibt null zurueck, und der Aufrufer nimmt sein Standardziel.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null

  const candidate = value.trim()
  if (candidate.length === 0) return null

  // Zeilenumbrueche koennten in einer Location-Kopfzeile eine zweite Kopfzeile
  // anhaengen. Node blockt das inzwischen selbst — hier trotzdem, weil die
  // Pruefung nichts kostet und nicht von der Laufzeit abhaengen soll.
  if (/[\r\n\t\0]/.test(candidate)) return null

  // Muss ein absoluter Pfad sein. Damit fallen "https://…", "javascript:…"
  // und relative Angaben wie "../admin" weg.
  if (!candidate.startsWith('/')) return null

  // "//host" und "/\host" sehen wie Pfade aus, werden vom Browser aber als
  // absolute URL zu einem fremden Host gelesen.
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return null

  return candidate
}
