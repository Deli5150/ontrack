import type { Cycle, Subscription } from './types'

// Calendar-day math on 'YYYY-MM-DD' strings, in local time.

const pad = (n: number): string => String(n).padStart(2, '0')

export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = (): string => ymd(new Date())

/** Noon local time, so adding days never trips over daylight saving changes. */
export function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12)
}

export const daysInMonth = (y: number, m0: number): number => new Date(y, m0 + 1, 0).getDate()

export function addDays(s: string, n: number): string {
  const d = toDate(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Months later, keeping the day of the month (or the month's last day when it's shorter). */
export function addMonths(s: string, n: number, day?: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(day ?? d, daysInMonth(ny, nm)))}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
}

/** The k-th payment date (k = 0 is the first). */
export function nthPayment(start: string, cycle: Cycle, k: number): string {
  const every = Math.max(1, cycle.every)
  switch (cycle.unit) {
    case 'day':
      return addDays(start, k * every)
    case 'week':
      return addDays(start, k * every * 7)
    case 'month':
      return addMonths(start, k * every)
    case 'year':
      return addMonths(start, k * every * 12)
  }
}

/** Roughly how many payments fit before `date` (an under-estimate, to start scanning from). */
function firstIndexNear(start: string, cycle: Cycle, date: string): number {
  const days = daysBetween(start, date)
  if (days <= 0) return 0
  const unitDays = { day: 1, week: 7, month: 28, year: 365 }[cycle.unit]
  const per = (cycle.unit === 'month' ? 31 : cycle.unit === 'year' ? 366 : unitDays) * Math.max(1, cycle.every)
  return Math.max(0, Math.floor(days / per) - 1)
}

/** Whether payment number k still happens (inside the duration and before cancelling). */
function paymentHappens(sub: Subscription, k: number, date: string): boolean {
  if (sub.type === 'once' && k > 0) return false
  if (sub.duration.kind === 'payments' && k >= sub.duration.count) return false
  if (sub.duration.kind === 'until' && date > sub.duration.date) return false
  if (sub.cancelledAt && date > sub.cancelledAt) return false
  return true
}

/** Every payment date from `from` to `to` (inclusive). */
export function paymentsBetween(sub: Subscription, from: string, to: string): string[] {
  const out: string[] = []
  for (let k = firstIndexNear(sub.startDate, sub.cycle, from); k < 100_000; k++) {
    const date = nthPayment(sub.startDate, sub.cycle, k)
    if (date > to || !paymentHappens(sub, k, date)) break
    if (date >= from) out.push(date)
  }
  return out
}

/** The next payment on or after `from` (today by default), or null when there are none left. */
export function nextPayment(sub: Subscription, from = today()): string | null {
  for (let k = firstIndexNear(sub.startDate, sub.cycle, from); k < 100_000; k++) {
    const date = nthPayment(sub.startDate, sub.cycle, k)
    if (!paymentHappens(sub, k, date)) return null
    if (date >= from) return date
  }
  return null
}

/** Payments already made (before today), newest first. */
export function pastPayments(sub: Subscription, until = today()): string[] {
  return paymentsBetween(sub, sub.startDate, addDays(until, -1)).reverse()
}

/** The price charged on `date`: the latest price change on or before it (the history includes the current price). */
export function priceOn(sub: Subscription, date: string): number {
  const history = [...sub.priceHistory].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (!history.length) return sub.price
  let price = history[0].price
  for (const p of history) if (p.date <= date) price = p.price
  return price
}

/** What a subscription costs per month on average (one-off payments cost nothing monthly). */
export function monthlyCost(sub: Pick<Subscription, 'price' | 'cycle' | 'type'>): number {
  if (sub.type === 'once') return 0
  const every = Math.max(1, sub.cycle.every)
  switch (sub.cycle.unit) {
    case 'day':
      return (sub.price * 365.25) / 12 / every
    case 'week':
      return (sub.price * 52.1786) / 12 / every
    case 'month':
      return sub.price / every
    case 'year':
      return sub.price / 12 / every
  }
}

/** Active: not cancelled and still has payments coming. */
export const isActive = (sub: Subscription): boolean => !sub.cancelledAt && nextPayment(sub) !== null

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "Nov 16, 2026" */
export function formatDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

export function relativeDays(date: string, from = today()): string {
  const n = daysBetween(from, date)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

/** "Every month", "Every 2 weeks", … */
export function cycleLabel(c: Cycle): string {
  if (c.every === 1) return `Every ${c.unit}`
  return `Every ${c.every} ${c.unit}s`
}

/** "/mo", "/yr", "/2 wk" … */
export function cycleShort(c: Cycle): string {
  const u = { day: 'day', week: 'wk', month: 'mo', year: 'yr' }[c.unit]
  return c.every === 1 ? `/${u}` : `/${c.every} ${u}`
}

/** The status line under a subscription's name. */
export function statusLine(sub: Subscription): string {
  if (sub.cancelledAt) return `Cancelled on ${formatDate(sub.cancelledAt)}`
  const next = nextPayment(sub)
  if (!next) {
    const last = pastPayments(sub)[0]
    return last ? `Ended · last paid ${formatDate(last)}` : 'Ended'
  }
  const when = relativeDays(next)
  const verb = sub.freeTrial && next === sub.startDate ? 'Trial ends' : sub.type === 'once' ? 'Due' : 'Renews'
  return `${verb} ${when} · ${formatDate(next)}`
}
