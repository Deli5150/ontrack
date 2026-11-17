import { strFromU8, unzipSync } from 'fflate'

// Reading the first sheet of an Excel workbook (.xlsx) as rows of text, enough for importing a list
// of subscriptions or a statement. An .xlsx is a zip of XML files: the sheet's cells point into a
// shared table of strings, and dates are day numbers that only their number format marks as dates.

const unescape = (t: string): string =>
  t.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e: string) =>
    e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : e === 'amp' ? '&' : String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  )

/** All the text runs inside a piece of XML (a shared string can be split into formatted runs). */
const textOf = (xml: string): string => unescape([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

const attr = (tag: string, name: string): string | null => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null

/** Column letters → index ("A" → 0, "AB" → 27). */
const columnIndex = (ref: string): number => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/** Excel's day number → YYYY-MM-DD (day 25569 is 1970-01-01). */
const serialDate = (n: number): string => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10)

export function rowsFromXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, { filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(f.name) })
  const read = (name: string): string => (files[name] ? strFromU8(files[name]) : '')

  // The first sheet in the workbook's order (not necessarily sheet1.xml).
  const workbook = read('xl/workbook.xml')
  const firstId = attr(/<sheet\s[^>]*>/.exec(workbook)?.[0] ?? '', 'r:id')
  const rel = firstId ? [...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, 'Id') === firstId) : undefined
  const target = rel ? attr(rel, 'Target') : null
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target}`) : Object.keys(files).filter((f) => f.startsWith('xl/worksheets/')).sort()[0]
  const sheet = sheetPath ? read(sheetPath) : ''
  if (!sheet) return []

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))

  // Which cell styles are dates: built-in date formats, or custom ones with day/month/year codes.
  const styles = read('xl/styles.xml')
  const customDates = new Set(
    [...styles.matchAll(/<numFmt\s[^>]*>/g)]
      .map((m) => m[0])
      .filter((t) => /[dmy]/i.test((attr(t, 'formatCode') ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '')))
      .map((t) => Number(attr(t, 'numFmtId')))
  )
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? ''
  const dateStyle = [...cellXfs.matchAll(/<xf\s[^>]*>/g)].map((m) => {
    const id = Number(attr(m[0], 'numFmtId') ?? 0)
    return BUILTIN_DATES.has(id) || customDates.has(id)
  })

  const rows: string[][] = []
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = c[1]
      const inner = c[2] ?? ''
      const ref = attr(tag, 'r')
      const at = ref ? columnIndex(ref) : cells.length
      const type = attr(tag, 't')
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let text = ''
      if (type === 's') text = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') text = textOf(inner)
      else if (type === 'b') text = v === '1' ? 'TRUE' : 'FALSE'
      else if (v !== undefined) {
        const n = Number(v)
        text = !type && Number.isFinite(n) && dateStyle[Number(attr(tag, 's') ?? 0)] ? serialDate(n) : unescape(v)
      }
      while (cells.length < at) cells.push('')
      cells[at] = text.trim()
    }
    if (cells.some(Boolean)) rows.push(cells)
  }
  return rows
}
