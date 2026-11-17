import { ALL_SERVICES, findService, type Service } from '../data/catalog'
import { categoryIdFor, DEFAULT_CATEGORIES } from './defaults'
import { addDays, daysBetween, today, ymd } from './dates'
import type { OcrLine } from '../../modules/ontrack-ocr/src/OntrackOcrModule'
import type { Cycle } from './types'

// Turning text into subscriptions: what someone typed ("Netflix 15.99 monthly"), text read from a
// screenshot or PDF, and bank statements (CSV) where repeated charges reveal subscriptions.

export interface Draft {
  name: string
  price: number
  currency: string
  cycle: Cycle
  /** The next (or last seen) payment, if the text says. */
  date: string | null
  service: Service | null
  categoryId: string
  /** Why this was suggested ("4 charges, about monthly"). */
  reason?: string
}

const SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '₺': 'TRY', '₱': 'PHP', '₪': 'ILS', '₦': 'NGN' }
const CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'MXN', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'ZAR', 'NZD', 'SGD', 'HKD', 'DOP']

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const AMOUNT = /(?:([$€£¥₹₩₺₱₪₦])|\b(USD|EUR|GBP|CAD|AUD|JPY|INR|BRL|MXN|CHF|SEK|NOK|DKK|PLN|ZAR|NZD|SGD|HKD|DOP)\s?)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:\b(USD|EUR|GBP|CAD|AUD)\b)?/gi

const CYCLE_WORDS: Array<[RegExp, Cycle]> = [
  [/\b(daily|per day|a day|\/day)\b/i, { every: 1, unit: 'day' }],
  [/\b(bi-?weekly|every (2|two|other) weeks?|fortnight(ly)?)\b/i, { every: 2, unit: 'week' }],
  [/\b(weekly|per week|a week|\/ ?wk|\/ ?week|wk)\b/i, { every: 1, unit: 'week' }],
  [/\b(quarterly|every (3|three) months?)\b/i, { every: 3, unit: 'month' }],
  [/\b(semi-?annual(ly)?|every (6|six) months?|half-?yearly)\b/i, { every: 6, unit: 'month' }],
  [/\b(yearly|annual(ly)?|per year|a year|\/ ?yr|\/ ?year|yr|p\.?a\.?)\b/i, { every: 1, unit: 'year' }],
  [/\b(monthly|per month|a month|\/ ?mo(nth)?|mo|mthly|pm)\b/i, { every: 1, unit: 'month' }]
]

function cycleIn(text: string): Cycle | null {
  const every = /\bevery\s+(\d+)\s*(day|week|month|year)s?\b/i.exec(text)
  if (every) return { every: Number(every[1]), unit: every[2].toLowerCase() as Cycle['unit'] }
  for (const [re, c] of CYCLE_WORDS) if (re.test(text)) return c
  return null
}

/** A date written in `text` ("Dec 10, 2026", "2026-12-10", "12/10/2026", "on the 15th"), or null. */
export function dateIn(text: string, base = today()): string | null {
  const iso = /\b(20\d\d)-(\d\d?)-(\d\d?)\b/.exec(text)
  if (iso) return ymd(new Date(+iso[1], +iso[2] - 1, +iso[3], 12))
  const named = /\b(\d{1,2})?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})?(?:st|nd|rd|th)?,?\s*(20\d\d)?\b/i.exec(text)
  if (named && (named[1] || named[3])) {
    const m = MONTHS.indexOf(named[2].toLowerCase().slice(0, 3))
    const d = Number(named[3] ?? named[1])
    let y = named[4] ? Number(named[4]) : Number(base.slice(0, 4))
    if (!named[4] && ymd(new Date(y, m, d, 12)) < base) y++
    if (d >= 1 && d <= 31) return ymd(new Date(y, m, d, 12))
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(text)
  if (slash) {
    let y = Number(slash[3])
    if (y < 100) y += 2000
    const [a, b] = [Number(slash[1]), Number(slash[2])]
    // Month first unless that's impossible.
    const [m, d] = a > 12 ? [b, a] : [a, b]
    return ymd(new Date(y, m - 1, d, 12))
  }
  const dayOnly = /\b(?:on the|on|every)\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text)
  if (dayOnly) {
    const d = Number(dayOnly[1])
    const b = new Date(Number(base.slice(0, 4)), Number(base.slice(5, 7)) - 1, d, 12)
    if (ymd(b) < base) b.setMonth(b.getMonth() + 1)
    return ymd(b)
  }
  return null
}

const parseNumber = (raw: string): number => {
  // "1,299.00" → 1299; "15,99" (comma decimals) → 15.99
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replace(/,/g, ''))
  return Number(raw.replace(',', '.'))
}

interface Money {
  amount: number
  currency: string | null
  index: number
  length: number
}

function amountsIn(text: string): Money[] {
  const out: Money[] = []
  for (const m of text.matchAll(AMOUNT)) {
    const amount = parseNumber(m[3])
    const currency = m[1] ? SYMBOLS[m[1]] : (m[2] ?? m[4])?.toUpperCase() ?? null
    // Skip years, days of the month and the like unless they look like money.
    const looksLikeMoney = currency || /[.,]\d{2}$/.test(m[3])
    if (!Number.isFinite(amount) || amount <= 0 || (!looksLikeMoney && (amount >= 1900 || Number.isInteger(amount) === false))) continue
    out.push({ amount, currency, index: m.index ?? 0, length: m[0].length })
  }
  return out
}

/** The money amount to use from a piece of text: one with a currency or cents, else the first number. */
function bestAmount(text: string): Money | null {
  const all = amountsIn(text)
  return all.find((a) => a.currency) ?? all.find((a) => !Number.isInteger(a.amount)) ?? all[0] ?? null
}

const titleCase = (t: string): string => t.replace(/\b([a-z])/g, (c) => c.toUpperCase())

function draftFrom(name: string, money: Money | null, cycle: Cycle | null, date: string | null, fallbackCurrency: string, reason?: string): Draft {
  const service = findService(name)
  return {
    name: service?.name ?? titleCase(name.trim()),
    price: money?.amount ?? service?.price ?? 0,
    currency: money?.currency ?? fallbackCurrency,
    cycle: cycle ?? (service?.yearly ? { every: 1, unit: 'year' } : { every: 1, unit: 'month' }),
    date,
    service,
    categoryId: service ? categoryIdFor(service.category) : 'other',
    reason
  }
}

/**
 * What someone typed or pasted: one subscription per line (or separated by ";" or " and "),
 * e.g. "Netflix 15.99 monthly", "Spotify $11.99/mo on the 3rd", "iCloud 2.99".
 */
export function parseTyped(text: string, currency: string): Draft[] {
  const parts = text
    .split(/\n|;|,(?!\d)|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean)
  const drafts: Draft[] = []
  for (const part of parts) {
    const money = bestAmount(part)
    const cycle = cycleIn(part)
    const date = dateIn(part)
    let name = part
    if (money) name = name.slice(0, money.index) + ' ' + name.slice(money.index + money.length)
    name = name
      .replace(/\bevery\s+\d+\s*(day|week|month|year)s?\b/gi, ' ')
      .replace(/\b(daily|weekly|bi-?weekly|monthly|quarterly|yearly|annual(ly)?|semi-?annual(ly)?|per (day|week|month|year)|a (day|week|month|year))\b/gi, ' ')
      .replace(/\/\s*(mo(nth)?|yr|year|wk|week|day)\b/gi, ' ')
      .replace(/\b(on the|on|renews?|due|next|payment|billed|for|at|is|costs?)\b.*$/i, (m) => (dateIn(m) ? ' ' : m))
      .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, ' ')
      .replace(/[-–—:|@]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!name && !money) continue
    drafts.push(draftFrom(name || 'Subscription', money, cycle, date, currency))
  }
  return drafts
}

// ── Bank statements ────────────────────────────────────────────────────────────────────────

export interface Charge {
  date: string
  description: string
  amount: number
}

/** Splits one CSV line, honouring quotes. */
function csvCells(line: string, sep: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === sep && !quoted) {
      cells.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  cells.push(cur.trim())
  return cells
}

function anyDate(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const d = dateIn(t, '1900-01-01')
  if (d) return d
  const parsed = Date.parse(t)
  return Number.isNaN(parsed) ? null : ymd(new Date(parsed))
}

const moneyCell = (t: string): number | null => {
  const clean = t.replace(/[^\d.,()-]/g, '')
  if (!/\d/.test(clean)) return null
  const negative = clean.startsWith('-') || clean.startsWith('(')
  const n = parseNumber(clean.replace(/[()-]/g, ''))
  return Number.isFinite(n) ? (negative ? -n : n) : null
}

/** The cells of a CSV (or tab/semicolon separated) file. */
export function csvRows(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const sep = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0]
  return lines.map((l) => csvCells(l, sep))
}

/** Charges (money going out) from a bank or card CSV export. */
export function chargesFromCsv(text: string): Charge[] {
  return chargesFromRows(csvRows(text))
}

const headerRowAt = (rows: string[][]): number =>
  rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /desc|payee|merchant|name|details|memo|narrative|transaction/i.test(c)))

/** Charges from the rows of a statement export (CSV or spreadsheet). */
export function chargesFromRows(rows: string[][]): Charge[] {
  if (rows.length < 2) return []
  // The header row: the first with a date-ish and a description-ish column.
  const headerAt = headerRowAt(rows)
  const header = headerAt >= 0 ? rows[headerAt].map((c) => c.toLowerCase()) : []
  const find = (re: RegExp): number => header.findIndex((c) => re.test(c))
  let dateCol = find(/^(transaction |trans\.? |posted |posting )?date/)
  if (dateCol < 0) dateCol = find(/date/)
  let descCol = find(/desc|payee|merchant|name|details|memo|narrative/)
  const amountCol = find(/^amount|amount$|^value/)
  const debitCol = find(/debit|withdrawal|money out|paid out|outflow/)
  const body = rows.slice(headerAt + 1)
  if (dateCol < 0) dateCol = body[0]?.findIndex((c) => anyDate(c) !== null) ?? -1
  if (descCol < 0) descCol = body[0]?.findIndex((c, i) => i !== dateCol && /[a-z]{3}/i.test(c)) ?? -1
  if (dateCol < 0 || descCol < 0) return []
  // Some banks show spending as negative amounts, others as positive; spending is the more common sign.
  const amounts = body.map((r) => (amountCol >= 0 ? moneyCell(r[amountCol] ?? '') : null)).filter((n): n is number => n !== null)
  const spendingNegative = amounts.filter((n) => n < 0).length >= amounts.filter((n) => n > 0).length
  const charges: Charge[] = []
  for (const r of body) {
    const date = anyDate(r[dateCol] ?? '')
    const description = (r[descCol] ?? '').trim()
    let amount: number | null = null
    if (debitCol >= 0) amount = moneyCell(r[debitCol] ?? '')
    if ((amount === null || amount === 0) && amountCol >= 0) {
      const a = moneyCell(r[amountCol] ?? '')
      if (a !== null) amount = spendingNegative ? (a < 0 ? -a : null) : a > 0 ? a : null
    }
    if (amount === null) {
      const fallback = r.map((c, i) => (i === dateCol || i === descCol ? null : moneyCell(c))).find((n) => n !== null && n !== 0)
      amount = fallback ?? null
    }
    if (date && description && amount && amount > 0) charges.push({ date, description, amount: Math.abs(amount) })
  }
  return charges
}

/** Charges from free text (a PDF statement or a screenshot): lines with a date, a description and an amount. */
export function chargesFromText(text: string): Charge[] {
  const charges: Charge[] = []
  for (const line of text.split(/\r?\n/)) {
    const date = /\d/.test(line) ? dateIn(line, '1900-01-01') : null
    if (!date) continue
    const all = amountsIn(line).filter((a) => !Number.isInteger(a.amount) || a.currency)
    if (!all.length) continue
    const money = all[0]
    const description = line
      .slice(0, money.index)
      .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b20\d\d-\d\d-\d\d\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2},?(\s*20\d\d)?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (description.length >= 3) charges.push({ date, description, amount: money.amount })
  }
  return charges
}

/** "SQ *NETFLIX.COM 866-579-7172 CA" → "netflix" */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/^(pos|debit|credit|purchase|recurring|card|ach|online|pmt|payment|autopay|direct debit|dd|visa|mc)\b[\s:*-]*/g, '')
    .replace(/\b(sq|tst|pp|paypal|apple\.com\/bill|google|amzn mktp|sp)\s*\*\s*/g, (m) => (m.includes('apple') ? 'apple ' : ''))
    .replace(/\.(com|net|org|co|io|tv|ai)\b.*$/, '')
    .replace(/[#*]\S*/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|usa|us|ca|ny|www|subscription|membership|monthly|bill|recurring)\b/g, ' ')
    .replace(/[^a-z& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function cycleForGap(days: number): Cycle | null {
  if (days >= 6 && days <= 8) return { every: 1, unit: 'week' }
  if (days >= 13 && days <= 16) return { every: 2, unit: 'week' }
  if (days >= 26 && days <= 35) return { every: 1, unit: 'month' }
  if (days >= 85 && days <= 95) return { every: 3, unit: 'month' }
  if (days >= 175 && days <= 190) return { every: 6, unit: 'month' }
  if (days >= 355 && days <= 375) return { every: 1, unit: 'year' }
  return null
}

const cycleWord = (c: Cycle): string =>
  c.unit === 'week' ? (c.every === 2 ? 'every 2 weeks' : 'weekly') : c.unit === 'year' ? 'yearly' : c.every === 1 ? 'monthly' : `every ${c.every} months`

/**
 * Subscriptions hiding in a list of charges: the same merchant charging a similar amount at a
 * regular interval, or a single charge from a well-known subscription service.
 */
export function findRecurring(charges: Charge[], currency: string): Draft[] {
  const groups = new Map<string, Charge[]>()
  for (const c of charges) {
    const key = merchantKey(c.description)
    if (key.length < 2) continue
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const drafts: Draft[] = []
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1))
    const service = findService(list[0].description) ?? findService(key)
    const last = list[list.length - 1]
    // Similar amounts: within 25% of the latest.
    const similar = list.filter((c) => Math.abs(c.amount - last.amount) <= last.amount * 0.25)
    let cycle: Cycle | null = null
    if (similar.length >= 2) {
      const gaps = similar.slice(1).map((c, i) => daysBetween(similar[i].date, c.date))
      cycle = cycleForGap(median(gaps))
    }
    if (!cycle && !service) continue
    const c = cycle ?? (service?.yearly ? { every: 1, unit: 'year' as const } : { every: 1, unit: 'month' as const })
    const draft = draftFrom(service?.name ?? key, { amount: last.amount, currency, index: 0, length: 0 }, c, null, currency)
    draft.date = nextFrom(last.date, c)
    draft.reason = cycle ? `${similar.length} charges, ${cycleWord(c)}` : `Known subscription · last charged ${last.date}`
    drafts.push(draft)
  }
  return drafts.sort((a, b) => b.price - a.price)
}

/** The first payment date on or after today, counting from a past charge. */
function nextFrom(date: string, cycle: Cycle): string {
  const t = today()
  let d = date
  for (let i = 0; i < 2000 && d < t; i++) {
    d = cycle.unit === 'day' ? addDays(d, cycle.every) : cycle.unit === 'week' ? addDays(d, 7 * cycle.every) : addMonthsKeep(d, cycle.unit === 'year' ? 12 * cycle.every : cycle.every)
  }
  return d
}

function addMonthsKeep(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, 1, 12)
  dt.setDate(Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()))
  return ymd(dt)
}

/**
 * Puts the lines read from a picture back into rows, left to right, so "Netflix" on the left and
 * "$15.99" on the right of the same row read as one line. Two lines share a row when their middles
 * are within half a line's height of each other.
 */
export function textInRows(lines: OcrLine[]): string {
  const rows: Array<{ mid: number; h: number; items: OcrLine[] }> = []
  for (const l of [...lines].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))) {
    const mid = l.y + l.h / 2
    const row = rows.find((r) => Math.abs(r.mid - mid) < Math.min(r.h, l.h) * 0.5)
    if (row) {
      row.items.push(l)
      row.mid = (row.mid * (row.items.length - 1) + mid) / row.items.length
    } else rows.push({ mid, h: l.h, items: [l] })
  }
  return rows
    .sort((a, b) => a.mid - b.mid)
    .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.text.trim()).join('  '))
    .join('\n')
}

// ── Lists of subscriptions ─────────────────────────────────────────────────────────────────

/** A category for something that isn't in the catalog, from words in its name ("Car loan" → Finance). */
export function guessCategory(name: string): string {
  const n = name.toLowerCase()
  if (/\b(loan|debt|credit|card|visa|mastercard|amex|discover|capital one|chase|citi|affirm|klarna|afterpay|bnpl|finance|bank|savings|invest|tax)\b/.test(n)) return 'finance'
  if (/\b(rent|mortgage|hoa|electric|electricity|power|water|gas|utilit(y|ies)|trash|sewer|energy)\b/.test(n)) return 'housing'
  if (/\b(insurance|insur|geico|progressive|allstate|state farm|lemonade)\b/.test(n)) return 'insurance'
  if (/\b(phone|mobile|wireless|internet|wifi|broadband|cable|fiber|verizon|at&t|t-mobile|comcast|xfinity|spectrum)\b/.test(n)) return 'phone'
  if (/\b(car|auto|vehicle|parking|toll|transit|metro|lease)\b/.test(n)) return 'transport'
  if (/\b(gym|fitness|health|medical|dental|therapy|pharmacy)\b/.test(n)) return 'health'
  if (/\b(tuition|school|college|course|class)\b/.test(n)) return 'education'
  return 'other'
}

/** The default category id named by a spreadsheet's category cell ("Streaming", "music"), if any. */
function categoryNamed(cell: string): string | null {
  const c = cell.trim().toLowerCase()
  if (!c) return null
  const hit = DEFAULT_CATEGORIES.find((k) => k.id === c || k.name.toLowerCase() === c || k.name.toLowerCase().split(/ & | /).includes(c))
  if (hit) return hit.id
  const guessed = guessCategory(c)
  return guessed === 'other' ? null : guessed
}

/** Rows that sum things up rather than being a subscription. */
const SUMMARY = /^\s*(grand\s+)?(total|subtotal|sum|average|balance|spent|spending|overall|monthly (cost|total|spend)|yearly (cost|total|spend)|per (month|year)|all)\b/i

/** One subscription per row: name, price, and optionally how often, the next date and a category. */
function draftFromCells(name: string, priceCell: string, cycleCell: string, dateCell: string, categoryCell: string, currency: string): Draft | null {
  if (!name.trim() || SUMMARY.test(name)) return null
  const service = findService(name)
  const money = bestAmount(priceCell) ?? (moneyCell(priceCell) ? { amount: Math.abs(moneyCell(priceCell)!), currency: null, index: 0, length: 0 } : null)
  if (!money && !service) return null
  const draft = draftFrom(name, money, cycleIn(cycleCell), null, currency)
  // Keep the name as written unless it's clearly the catalog service.
  if (service && norm(name) !== norm(service.name) && !norm(name).includes(norm(service.name))) draft.service = null
  if (!draft.service) {
    draft.name = name.trim()
    draft.categoryId = guessCategory(name)
  }
  draft.categoryId = categoryNamed(categoryCell) ?? draft.categoryId
  const date = sheetDate(dateCell)
  if (date) draft.date = nextFrom(date, draft.cycle)
  return draft
}

const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9+]/g, '')

/** A date cell: a full date, or just a day of the month ("15", "15th") for things due monthly. */
function sheetDate(cell: string): string | null {
  const t = cell.trim()
  if (!t) return null
  const day = /^(\d{1,2})(st|nd|rd|th)?$/i.exec(t)
  if (day) {
    const d = Number(day[1])
    if (d < 1 || d > 31) return null
    const base = today()
    return `${base.slice(0, 8)}${String(Math.min(d, daysInMonthOf(base))).padStart(2, '0')}`
  }
  if (!/\d/.test(t)) return null
  return dateIn(t) ?? anyDate(t)
}

const daysInMonthOf = (ymdText: string): number => new Date(Number(ymdText.slice(0, 4)), Number(ymdText.slice(5, 7)), 0).getDate()

/** Is this a column of money? (Cells with a currency sign or cents, ignoring blanks.) */
const moneyColumn = (body: string[][], i: number): boolean => {
  const cells = body.map((r) => (r[i] ?? '').trim()).filter(Boolean)
  return cells.length > 0 && cells.filter((c) => /^[-(]?\s*([$€£¥₹]|[A-Z]{3})?\s*-?\d[\d,]*([.,]\d{1,2})?\s*\)?$/.test(c) && /[$€£¥₹]|[.,]\d{2}\b/.test(c)).length >= cells.length * 0.6
}

/**
 * A spreadsheet that lists subscriptions, bills or debts, one per row ("Netflix | 15.99 | Monthly |
 * 12/03"), rather than a bank statement.
 */
export function subsFromRows(rows: string[][], currency: string): Draft[] {
  const nameRe = /^(name|service|subscription|bill|item|company|provider|payee|merchant|creditor|lender|account|debt|loan|description|title|expense|vendor|app)s?\b|\b(name|service|subscription|bill|debt|creditor|lender)s?$/i
  // A header names its columns and has no numbers in it (so a row like "Phone bill, 65.00" isn't one).
  const headerAt = rows.slice(0, 10).findIndex((r) => !r.some((c) => /\d/.test(c)) && r.some((c) => nameRe.test(c.trim())) && r.some((c) => /price|cost|amount|payment|fee|charge|monthly|bill|due|pay/i.test(c)))
  const header = headerAt >= 0 ? rows[headerAt].map((c) => c.trim().toLowerCase()) : []
  const body = rows.slice(headerAt + 1).filter((r) => r.some((c) => c.trim()))
  const find = (...res: RegExp[]): number => {
    for (const re of res) {
      const i = header.findIndex((c) => re.test(c))
      if (i >= 0) return i
    }
    return -1
  }
  let nameCol = find(nameRe, /desc|payee|merchant/)
  // The amount paid each time, not what's left to pay or the interest rate.
  const notPrice = /balance|owed|remaining|left|limit|apr|rate|interest|%|total paid|original|principal/
  let priceCol = header.length
    ? [/min(imum)?\.? ?pay|payment|monthly/, /price|cost|fee|charge|amount|bill|due/].reduce((hit, re) => (hit >= 0 ? hit : header.findIndex((c) => re.test(c) && !notPrice.test(c) && !/date|day|next|first|start|last|renew|when|frequen|cycle|method/.test(c))), -1)
    : -1
  const cycleCol = find(/frequen|cycle|billing period|period|interval|recurr|how often|every|renewal type|plan/)
  const dateCol = find(/next|due|renew|billing date|bill date|pay date|payment date|charge date|date|day/)
  const categoryCol = find(/categor|type|group|kind/)
  const currencyCol = find(/^(currency|ccy)$/)
  const statusCol = find(/^(status|state|active)$/)
  if (nameCol < 0) nameCol = (body[0] ?? []).findIndex((c, i) => i !== priceCol && /[a-z]{2}/i.test(c) && !cycleIn(c))
  if (priceCol < 0) priceCol = (body[0] ?? []).findIndex((_, i) => i !== nameCol && moneyColumn(body, i))
  if (nameCol < 0 || priceCol < 0) return []
  const cell = (r: string[], i: number): string => (i >= 0 ? (r[i] ?? '') : '')
  const drafts: Draft[] = []
  for (const r of body) {
    if (/cancel|inactive|ended|paused/i.test(cell(r, statusCol))) continue
    const code = cell(r, currencyCol).trim().toUpperCase()
    // A price written in the cycle column ("15.99/mo") still counts.
    const d = draftFromCells(cell(r, nameCol), cell(r, priceCol), cell(r, cycleCol) || cell(r, priceCol), cell(r, dateCol), cell(r, categoryCol), /^[A-Z]{3}$/.test(code) ? code : currency)
    if (d) drafts.push(d)
  }
  return drafts
}

/**
 * A spreadsheet or CSV: a bank statement (the same merchants charging again and again) gives the
 * repeated charges; anything else is read as a list with one subscription per row.
 */
export function parseSheet(rows: string[][], currency: string): Draft[] {
  const list = subsFromRows(rows, currency)
  const header = (rows[headerRowAt(rows)] ?? []).join(' ').toLowerCase()
  const listLike = /frequen|cycle|subscription|service|bill|debt|creditor|lender|loan|next|renew|categor/.test(rows.slice(0, 10).flat().join(' ').toLowerCase())
  const statementLike = /debit|credit|withdrawal|balance|posted|transaction|reference|deposit/.test(header)
  const charges = chargesFromRows(rows)
  const repeats = new Set<string>()
  const seen = new Set<string>()
  for (const c of charges) {
    const k = merchantKey(c.description)
    if (seen.has(k)) repeats.add(k)
    seen.add(k)
  }
  if (charges.length && repeats.size && (statementLike || !listLike || list.length === 0)) return findRecurring(charges, currency)
  if (list.length) return list
  return charges.length ? findRecurring(charges, currency) : []
}

/** Words on a subscription list that describe a row rather than name it. */
const FILLER = /\b(plan|individual|family|student|duo|premium|basic|standard|plus|tier|renews?|renewal|renewing|expires?|expiring|next|payment|billing|billed|bill|due|charged?|in|days?|left|today|tomorrow|trial|free|active|ends?|per|every|cycle|on|the|at|of|and|starting|since|price|auto|automatic|cancel(led)?|paid|upcoming|ago)\b/gi

/** The name part of a row on a subscription list, or '' when the row is details (price, cycle, date). */
function listName(line: string): string {
  return line
    .replace(AMOUNT, (m) => (/[$€£¥₹₩₺₱₪₦]|\d[.,]\d{2}\b|[A-Z]{3}/.test(m) ? ' ' : m))
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b20\d\d-\d\d-\d\d\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}(st|nd|rd|th)?,?(\s*20\d\d)?\b|\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(\s*20\d\d)?/gi, ' ')
    .replace(/\b(daily|weekly|bi-?weekly|fortnightly|monthly|quarterly|yearly|annual(ly)?|semi-?annual(ly)?|every\s+\d+\s*(day|week|month|year)s?|\/\s*(mo(nth)?|yr|year|wk|week|day)|(a|per) (day|week|month|year)|mo|yr)\b/gi, ' ')
    .replace(/\b\d+\s*(%|days?|d|weeks?|months?)\b/gi, ' ')
    .replace(FILLER, ' ')
    .replace(/[^\p{L}\p{N}&+'. ]+/gu, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.'\s]+|[.'\s]+$/g, '')
    .trim()
}

/**
 * A screenshot of a list of subscriptions (another subscription app, the App Store's subscriptions
 * page, a budgeting app): each entry is a row with a name and usually a price, sometimes with the
 * cycle or the next date on the same row or the next one.
 */
export function parseList(text: string, currency: string): Draft[] {
  interface Entry {
    name: string
    service: Service | null
    money: Money | null
    cycle: Cycle | null
    date: string | null
  }
  const entries: Entry[] = []
  let cur: Entry | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (SUMMARY.test(line)) {
      cur = null
      continue
    }
    const money = amountsIn(line).find((a) => a.currency || !Number.isInteger(a.amount)) ?? null
    const cycle = cycleIn(line)
    const date = /\d/.test(line) ? dateIn(line) : null
    const name = listName(line)
    const isName = /\p{L}.*\p{L}/u.test(name) && name.length <= 48 && (findService(line) !== null || name.split(' ').length <= 4)
    if (isName && (!cur || cur.name)) {
      cur = { name, service: findService(line), money: null, cycle: null, date: null }
      entries.push(cur)
    } else if (isName && cur) {
      cur.name = name
      cur.service = findService(line)
    }
    if (!cur) {
      if (!money) continue
      // Details before any name (a price shown above its name): hold them for the next name.
      cur = { name: '', service: null, money: null, cycle: null, date: null }
      entries.push(cur)
    }
    cur.money ??= money
    cur.cycle ??= cycle
    cur.date ??= date
  }
  const drafts: Draft[] = []
  for (const e of entries) {
    if (!e.name) continue
    // The service is looked up on the whole row: "YouTube Premium" is the service even though
    // "Premium" was dropped from the name as a plan word.
    const service = e.service ?? findService(e.name)
    if (!e.money && !service) continue
    const draft = draftFrom(service?.name ?? e.name, e.money, e.cycle, e.date, currency)
    if (!draft.service) draft.categoryId = guessCategory(e.name)
    drafts.push(draft)
  }
  return drafts
}

/** Words on a receipt or order confirmation, which is about one purchase however many lines it has. */
const RECEIPT = /\b(sub-?total|tax|vat|gst|order (id|number|no\.?|date)|receipt|invoice|billed to|document no|payment method|thank you for your (purchase|order|subscription))\b/i

/**
 * Text read from a screenshot or a PDF: a statement (the same merchant charged again and again)
 * gives the repeated charges; a list of subscriptions gives one each; otherwise it's a receipt or
 * renewal notice for one subscription.
 */
export function parseDocumentText(raw: string, currency: string): Draft[] {
  // Email addresses and links name services that aren't the subscription ("…@icloud.com").
  // OCR reads a lowercase i as "¡" in some fonts ("¡Cloud+").
  const text = raw.replace(/\S+@\S+\.\w+|\bhttps?:\/\/\S+|\bwww\.\S+/gi, ' ').replace(/¡/g, 'i')
  const charges = chargesFromText(text)
  const keys = charges.map((c) => merchantKey(c.description))
  const repeated = keys.some((k, i) => keys.indexOf(k) !== i)
  const recurring = charges.length >= 3 && repeated ? findRecurring(charges, currency) : []
  if (recurring.length) return recurring
  const list = RECEIPT.test(text) ? [] : parseList(text, currency)
  if (list.length >= 2) return list
  const service = findService(text)
  // Prefer a real amount (a currency or cents, not the "3" in "Renews Dec 3") near words like
  // price/renew, then total (which may include tax), then any.
  const lines = text.split(/\r?\n/)
  const moneyIn = (l: string): Money | null => amountsIn(l).find((a) => a.currency || !Number.isInteger(a.amount)) ?? null
  const near = (re: RegExp): Money | null => lines.filter((l) => re.test(l)).map(moneyIn).find(Boolean) ?? null
  const money = near(/price|renew|charged|billed|per\b|\/ ?mo|month|year|plan/i) ?? near(/total|amount/i) ?? lines.map(moneyIn).find(Boolean) ?? bestAmount(text)
  if (!service && !money) return []
  const renew = /(renew|next|due|billing date|expires?|trial ends?)[^\n]*/i.exec(text)
  const date = (renew && dateIn(renew[0])) || null
  const name = service?.name ?? text.split(/\r?\n/).find((l) => /[a-z]{3}/i.test(l))?.trim().slice(0, 40) ?? 'Subscription'
  return [draftFrom(name, money, cycleIn(text), date, currency)]
}

export { ALL_SERVICES }
