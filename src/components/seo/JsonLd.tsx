/**
 * Strukturierte Daten als `application/ld+json`.
 *
 * `dangerouslySetInnerHTML` ist hier der vorgesehene Weg — React wuerde den
 * JSON-Text sonst als Text escapen und Google faende kein gueltiges JSON. Die
 * eine gefaehrliche Zeichenfolge in diesem Zusammenhang ist `</script`, und
 * die kann nur ueber ein `<` entstehen: Deshalb wird genau dieses Zeichen in
 * seine Unicode-Schreibweise gesetzt, die innerhalb von JSON dasselbe
 * bedeutet und den Auszeichnungsparser des Browsers nicht mehr erreicht.
 *
 * Wichtig fuer die Nutzung: Hier darf ausschliesslich stehen, was auf der
 * Seite auch sichtbar ist. Strukturierte Daten, die etwas anderes behaupten
 * als der Fliesstext, sind bei Google ein Verstoss und kosten im Zweifel die
 * ganze Domain, nicht nur das Suchergebnis.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
