// Tagesplanung — SAP-Exporte im „Streaming-ZIP"-Modus lesbar machen.
//
// Eine xlsx-Datei ist ein ZIP-Container. SAP schreibt ihn teils im
// Streaming-Modus: Groesse und CRC stehen in den lokalen Kopfzeilen als 0 und
// erst hinter den Daten (Data Descriptor, Bit 3 der Flags). Das zentrale
// Verzeichnis am Ende der Datei hat die richtigen Werte. Parser, die den
// lokalen Kopfzeilen glauben, scheitern daran — deshalb werden die Werte aus
// dem zentralen Verzeichnis vor dem Parsen in die lokalen Kopfzeilen
// zurueckgeschrieben.
//
// Veraendert nur diese drei Felder, und nur dort, wo sie 0 sind. Die Eingabe
// bleibt unangetastet; zurueck kommt eine Kopie.

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_MIN_SIZE = 22
const MAX_COMMENT = 0xffff

export class ZipRepairError extends Error {}

export interface ZipRepairResult {
  bytes: Uint8Array
  /** Wie viele Eintraege nachgetragen wurden; 0 heisst: Die Datei war in Ordnung. */
  patched: number
}

export function repairStreamingZip(input: Uint8Array): ZipRepairResult {
  const bytes = new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  const eocd = findEocd(view)
  const entries = view.getUint16(eocd + 10, true)
  const centralSize = view.getUint32(eocd + 12, true)
  let offset = view.getUint32(eocd + 16, true)
  if (entries === 0xffff || offset === 0xffffffff || centralSize === 0xffffffff) {
    throw new ZipRepairError('ZIP64 wird nicht unterstuetzt.')
  }

  let patched = 0
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new ZipRepairError('Zentrales Verzeichnis ist beschaedigt.')
    }
    const crc = view.getUint32(offset + 16, true)
    const compressed = view.getUint32(offset + 20, true)
    const uncompressed = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)

    if (local + 30 > view.byteLength || view.getUint32(local, true) !== LOCAL_SIGNATURE) {
      throw new ZipRepairError('Lokale Kopfzeile nicht gefunden.')
    }
    let changed = false
    changed = patchIfZero(view, local + 14, crc) || changed
    changed = patchIfZero(view, local + 18, compressed) || changed
    changed = patchIfZero(view, local + 22, uncompressed) || changed
    if (changed) patched++

    offset += 46 + nameLength + extraLength + commentLength
  }
  return { bytes, patched }
}

function patchIfZero(view: DataView, at: number, value: number): boolean {
  if (view.getUint32(at, true) !== 0 || value === 0) return false
  view.setUint32(at, value, true)
  return true
}

/** Das Ende-Verzeichnis liegt am Dateiende, hinter einem optionalen Kommentar. */
function findEocd(view: DataView): number {
  const last = view.byteLength - EOCD_MIN_SIZE
  const first = Math.max(0, last - MAX_COMMENT)
  for (let at = last; at >= first; at--) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) return at
  }
  throw new ZipRepairError('Keine ZIP-Datei (Ende-Verzeichnis fehlt).')
}
