// Testdaten — ein minimaler ZIP-Schreiber (nur „stored", ohne Kompression).
//
// Gebraucht, um Dateien im Streaming-Modus zu erzeugen, wie SAP sie schreibt
// (Groesse/CRC in den lokalen Kopfzeilen = 0, Werte im Data Descriptor und im
// zentralen Verzeichnis). Keine xlsx-Bibliothek kann das gezielt — und ohne
// solche Dateien liesse sich repairStreamingZip nur gegen echte SAP-Exporte
// pruefen, die nicht ins Repository gehoeren.

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export function buildZip(entries: readonly ZipEntry[], options: { streaming?: boolean } = {}): Uint8Array {
  const streaming = options.streaming ?? false
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, streaming ? 0x0008 : 0, true)
    local.setUint16(8, 0, true) // stored
    local.setUint32(14, streaming ? 0 : crc, true)
    local.setUint32(18, streaming ? 0 : size, true)
    local.setUint32(22, streaming ? 0 : size, true)
    local.setUint16(26, name.length, true)
    const localBytes = concat([new Uint8Array(local.buffer), name, entry.data])

    let descriptor = new Uint8Array(0)
    if (streaming) {
      const d = new DataView(new ArrayBuffer(16))
      d.setUint32(0, 0x08074b50, true)
      d.setUint32(4, crc, true)
      d.setUint32(8, size, true)
      d.setUint32(12, size, true)
      descriptor = new Uint8Array(d.buffer)
    }

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, streaming ? 0x0008 : 0, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, size, true)
    c.setUint32(24, size, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    central.push(concat([new Uint8Array(c.buffer), name]))

    chunks.push(localBytes, descriptor)
    offset += localBytes.length + descriptor.length
  }

  const centralBytes = concat(central)
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, centralBytes.length, true)
  eocd.setUint32(16, offset, true)
  return concat([...chunks, centralBytes, new Uint8Array(eocd.buffer)])
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
