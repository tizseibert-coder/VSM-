/**
 * Der drehende Kreis, der einen Klick von einer laufenden Handlung
 * unterscheidet.
 *
 * Bis hierher endete ein Klick auf "Anmelden", "Konto erstellen" oder
 * "Kaufen" optisch nirgendwo — der Knopf sah bis zur Weiterleitung
 * unveraendert aus, egal ob die Anfrage 200 ms oder zwei Sekunden brauchte.
 * Wer in der Lücke noch einmal klickt, loest die Handlung doppelt aus (bei
 * "Kaufen" im schlimmsten Fall zwei Stripe-Kunden); wer nur wartet, sieht
 * keinen Unterschied zu einem Knopf, der nicht reagiert hat.
 *
 * `border-current`, damit der Kreis immer die Textfarbe des Knopfes traegt,
 * auf dem er sitzt — weiss im Primaerknopf, dunkel im Sekundaerknopf, rot im
 * Loeschen-Knopf — ohne dass jede Aufrufstelle eine eigene Farbe waehlen
 * muss. `motion-reduce:animate-none` haelt den Kreis fuer Nutzer mit
 * reduzierter Bewegung still stehend; das umschliessende `disabled` traegt
 * die Rueckmeldung dann allein.
 */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none ${className}`}
    />
  )
}
