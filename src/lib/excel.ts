// Dependency-free .xlsx writer.
//
// Bundle size matters on mobile, so instead of a spreadsheet library this
// builds a real OOXML workbook by hand: a handful of XML parts packed into a
// ZIP with STORED (uncompressed) entries. Excel, LibreOffice and Google Sheets
// open the result natively — no "format and extension don't match" warning
// like CSV/HTML files renamed to .xls produce.
//
// Conventions: the first row of every sheet is a bold header; numbers get a
// two-decimal thousands format; null/'' cells are left empty.

export type CellValue = string | number | null

export interface XlsxSheet {
  name: string
  rows: CellValue[][]
}

const encoder = new TextEncoder()

// ---------------------------------------------------------------------------
// ZIP (stored entries only — no compression, so no deflate dependency)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const size = file.data.length

    // Local file header (30 bytes) + name + raw data.
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)      // version needed to extract
    lv.setUint16(6, 0x0800, true)  // flag: UTF-8 file names
    lv.setUint16(8, 0, true)       // method: stored
    lv.setUint16(10, 0, true)      // mod time
    lv.setUint16(12, 0x0021, true) // mod date: 1980-01-01 (DOS epoch)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)   // compressed size
    lv.setUint32(22, size, true)   // uncompressed size
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)      // extra field length
    local.set(name, 30)
    chunks.push(local, file.data)

    // Central directory entry (46 bytes) + name. Zero-filled fields
    // (extra/comment lengths, disk number, attributes) are already 0.
    const entry = new Uint8Array(46 + name.length)
    const cv = new DataView(entry.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)      // version made by
    cv.setUint16(6, 20, true)      // version needed to extract
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)      // method: stored
    cv.setUint16(12, 0, true)      // mod time
    cv.setUint16(14, 0x0021, true) // mod date
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true) // local header offset
    entry.set(name, 46)
    central.push(entry)

    offset += local.length + size
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)  // entries on this disk
  ev.setUint16(10, files.length, true) // total entries
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)       // central directory offset

  const out = new Uint8Array(offset + centralSize + end.length)
  let pos = 0
  for (const chunk of [...chunks, ...central, end]) {
    out.set(chunk, pos)
    pos += chunk.length
  }
  return out
}

// ---------------------------------------------------------------------------
// OOXML parts
// ---------------------------------------------------------------------------

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + '\n'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

/** Escape text and drop control characters that XML 1.0 forbids. */
function xmlEscape(value: string): string {
  let clean = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    // Keep tab (9), newline (10) and carriage return (13); drop the rest.
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue
    clean += ch
  }
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 0 -> A, 25 -> Z, 26 -> AA … */
function colName(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Style ids used by the cells below (see STYLES_XML): 1 = bold header,
// 2 = number with thousands separator and two decimals.
function sheetXml(rows: CellValue[][]): string {
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0)

  // Size columns to their content so the file is readable without resizing.
  const widths: number[] = []
  for (let c = 0; c < colCount; c++) {
    let w = 10
    for (const row of rows) {
      const v = row[c]
      if (v == null) continue
      w = Math.max(w, Math.min(String(v).length + 2, 42))
    }
    widths.push(w)
  }
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')

  const body = rows.map((row, r) => {
    const cells = row.map((v, c) => {
      if (v == null || v === '') return ''
      const ref = `${colName(c)}${r + 1}`
      if (typeof v === 'number' && Number.isFinite(v)) {
        return `<c r="${ref}" s="2"><v>${v}</v></c>`
      }
      const style = r === 0 ? ' s="1"' : ''
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')

  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}"><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
}

const STYLES_XML = `${XML_DECL}<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs></styleSheet>'

const ROOT_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>'

function workbookXml(sheets: XlsxSheet[]): string {
  const entries = sheets
    .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')
  return `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${entries}</sheets></workbook>`
}

function workbookRels(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('')
  return `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">${sheets}` +
    `<Relationship Id="rId${sheetCount + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    '</Relationships>'
}

function contentTypesXml(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('')
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Builds a genuine .xlsx file (OOXML in a ZIP) from plain rows. */
export function buildXlsx(sheets: XlsxSheet[]): Blob {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet')
  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml(sheets.length)) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels(sheets.length)) },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(s.rows)) }))
  ]
  return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Triggers a browser download for a generated file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has started before the URL dies.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
