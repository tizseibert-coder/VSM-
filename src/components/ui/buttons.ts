/**
 * Die Knopfformen der Anwendung an einer einzigen Stelle.
 *
 * Vorher gab es vier Höhen (py-1, py-1.5, py-2, py-3) über rund 84 Knöpfe
 * verteilt, dazu elf Schreibweisen desselben Primärknopfs, die sich nur in
 * `transition-colors` oder `disabled:opacity-50` unterschieden. Derselbe
 * Knopftyp war damit in verschiedenen Ansichten unterschiedlich hoch, und der
 * Präsentationsmodus-Schalter wuchs sogar beim Klicken.
 *
 * Drei Größen, jede mit einer Regel, wann sie gilt. Wer eine vierte braucht,
 * merkt beim Suchen, dass es keine gibt — genau das ist der Zweck.
 *
 * Hinweis für Tailwind v4: Die Utilities stehen hier als Literale im
 * Quelltext und werden deshalb beim Scannen gefunden, obwohl die fertigen
 * Klassenketten erst zur Laufzeit zusammengesetzt werden.
 */

/** 44 px. Primärhandlungen und die Werkzeugleiste im Editor, die im Workshop
 *  am Trackpad bedient wird — das Fingerziel bestimmt hier die Höhe. */
const SIZE_LG = 'px-5 py-3 text-sm'

/** 36 px. Der Normalfall: Formulare, Listenzeilen, Kopfzeilen. */
const SIZE_MD = 'px-4 py-2 text-sm'

/** 32 px. Dichte Bedienelemente in den Bearbeitungspanels, wo mehrere
 *  Schaltflächen nebeneinander in einer Zeile stehen. */
const SIZE_SM = 'px-3 py-1.5 text-xs'

const BASE = 'rounded-control font-medium transition-colors disabled:opacity-50'
// Der durchsichtige Rahmen ist kein Zierrat: Ohne ihn ist der Primaerknopf
// genau 2 px flacher als der Sekundaerknopf daneben, weil dessen Rahmen bei
// border-box in die Hoehe zaehlt. Gemessen am Dashboard: 36 gegen 38 px.
const PRIMARY = `${BASE} border border-transparent bg-brand-600 text-white hover:bg-brand-700`
const SECONDARY = `${BASE} border border-zinc-300 text-zinc-700 hover:bg-zinc-100`

export const buttonPrimaryLg = `${PRIMARY} ${SIZE_LG}`
export const buttonPrimary = `${PRIMARY} ${SIZE_MD}`
export const buttonPrimarySm = `${PRIMARY} ${SIZE_SM}`

export const buttonSecondaryLg = `${SECONDARY} ${SIZE_LG}`
export const buttonSecondary = `${SECONDARY} ${SIZE_MD}`
export const buttonSecondarySm = `${SECONDARY} ${SIZE_SM}`

/**
 * Zerstörende Handlung. Ruhig, solange niemand hinzeigt: Ein dauerhaft rotes
 * "Löschen" neben jedem Projekt macht die Liste zur Warnlandschaft, und wer
 * täglich daran vorbeiliest, sieht das Rot irgendwann gar nicht mehr.
 */
export const buttonDangerSm = `${BASE} ${SIZE_SM} border border-zinc-300 text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700`

/** Eingabefelder, damit sie neben den Knöpfen auf derselben Höhe sitzen. */
export const inputMd = 'rounded-control border border-zinc-300 px-3 py-2 text-sm'
export const inputSm = 'rounded-control border border-zinc-300 px-2 py-1.5 text-sm'
