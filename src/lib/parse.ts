import { ALL_SERVICES, findService, type Service } from '../data/catalog'
import { categoryIdFor } from './defaults'
import { addDays, daysBetween, today, ymd } from './dates'
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

/** Charges (money going out) from a bank or card CSV export. */
export function chargesFromCsv(text: string): Charge[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0]
  const rows = lines.map((l) => csvCells(l, sep))
  // The header row: the first with a date-ish and a description-ish column.
  const headerAt = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /desc|payee|merchant|name|details|memo|narrative|transaction/i.test(c)))
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
 * Text read from a screenshot or a PDF: a statement (lines with dates and amounts) gives repeated
 * charges; otherwise it's a receipt or renewal notice for one subscription.
 */
export function parseDocumentText(text: string, currency: string): Draft[] {
  const charges = chargesFromText(text)
  const recurring = charges.length >= 3 ? findRecurring(charges, currency) : []
  if (recurring.length) return recurring
  const service = findService(text)
  const money = bestAmount(
    // Prefer an amount near words like total/price/renew.
    text.split(/\r?\n/).find((l) => /total|price|amount|renew|charged|billed|per|\/mo|month|year/i.test(l) && bestAmount(l)) ?? text
  )
  if (!service && !money) return []
  const renew = /(renew|next|due|billing date|expires?|trial ends?)[^\n]*/i.exec(text)
  const date = (renew && dateIn(renew[0])) || null
  const name = service?.name ?? text.split(/\r?\n/).find((l) => /[a-z]{3}/i.test(l))?.trim().slice(0, 40) ?? 'Subscription'
  return [draftFrom(name, money, cycleIn(text), date, currency)]
}

export { ALL_SERVICES }
