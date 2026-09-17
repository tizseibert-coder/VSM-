// /dashboard ist die Einstiegsseite nach der Anmeldung — bis
// docs/plan-company-overview-modules.md, Schritt 3, zeigt sie unveraendert
// die VSM-Projektliste (jetzt an ihrer eigenen Adresse, /projects). Die
// Weiche zwischen "einfache Organisation → Projektliste direkt" und
// "komplexe Organisation → Firmenuebersicht mit Modul-Kacheln" kommt in
// Schritt 3 hierher; bis dahin ist dieser Re-Export absichtlich die ganze
// Datei, damit sich am heutigen Verhalten nichts aendert.
export { default } from '../projects/page'
