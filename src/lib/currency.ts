import type { Rates } from './types'

// Currencies and conversion into the preferred currency. Rates come from open.er-api.com (free, no
// key) once a day; until then these built-in ones (late 2026, approximate) are used.

export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' }
]

export const DEFAULT_RATES: Rates = {
  fetchedAt: 0,
  perUsd: {
    USD: 1, EUR: 0.86, GBP: 0.75, CAD: 1.38, AUD: 1.52, NZD: 1.72, JPY: 151, CNY: 7.1, INR: 88, KRW: 1400,
    BRL: 5.4, MXN: 18.5, CHF: 0.8, SEK: 9.4, NOK: 10.1, DKK: 6.4, PLN: 3.65, TRY: 42, ZAR: 17.4, SGD: 1.3,
    HKD: 7.78, PHP: 58, IDR: 16500, THB: 32.5, AED: 3.67, SAR: 3.75, ILS: 3.3, NGN: 1450, DOP: 63, COP: 3900,
    ARS: 1400, CLP: 940
  }
}

export const currencyOf = (code: string): Currency => CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, name: code }

const NO_DECIMALS = new Set(['JPY', 'KRW', 'IDR', 'CLP'])

/** "$1,559.82" */
export function formatMoney(amount: number, code: string): string {
  const digits = NO_DECIMALS.has(code) ? 0 : 2
  const n = Math.abs(amount)
    .toFixed(digits)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${amount < 0 ? '-' : ''}${currencyOf(code).symbol}${n}`
}

export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (from === to) return amount
  const a = rates.perUsd[from] ?? DEFAULT_RATES.perUsd[from]
  const b = rates.perUsd[to] ?? DEFAULT_RATES.perUsd[to]
  if (!a || !b) return amount
  return (amount / a) * b
}

/** Today's rates, or null when they can't be fetched. */
export async function fetchRates(): Promise<Rates | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (json.result !== 'success' || !json.rates) return null
    return { perUsd: json.rates, fetchedAt: Date.now() }
  } catch {
    return null
  }
}
