// OnTrack's data model. Dates are local calendar days as 'YYYY-MM-DD' strings.

export type CycleUnit = 'day' | 'week' | 'month' | 'year'
export interface Cycle {
  every: number
  unit: CycleUnit
}

export type Logo =
  | { kind: 'domain'; domain: string }
  | { kind: 'icon'; name: string; color: string }
  | { kind: 'emoji'; emoji: string; color: string }
  | { kind: 'image'; uri: string }

export type Duration = { kind: 'forever' } | { kind: 'payments'; count: number } | { kind: 'until'; date: string }

export interface PricePoint {
  /** The first payment this price applies to. */
  date: string
  price: number
}

export interface Subscription {
  id: string
  name: string
  logo: Logo | null
  /** Background behind the logo, and the subscription's dot in the orbit. */
  color: string
  price: number
  currency: string
  /** The first payment (when there's a free trial: the day it ends and the first charge happens). */
  startDate: string
  type: 'recurring' | 'once'
  cycle: Cycle
  duration: Duration
  freeTrial: boolean
  listId: string
  categoryId: string
  paymentMethodId: string | null
  /** Days before a payment to remind; null = no reminder. */
  notify: number | null
  /** Every price and the day it started (the last one is `price`). */
  priceHistory: PricePoint[]
  url: string
  notes: string
  cancelledAt: string | null
  createdAt: number
}

export interface List {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  color: string
}

export type PaymentKind = 'card' | 'bank' | 'paypal' | 'apple' | 'google' | 'cash' | 'crypto' | 'other'
export interface PaymentMethod {
  id: string
  name: string
  kind: PaymentKind
}

export type SortKey = 'next' | 'price' | 'name'

export interface Settings {
  currency: string
  /** A list's id, or 'all'. */
  listId: string
  sort: SortKey
  sortAsc: boolean
  cancelledOpen: boolean
  notifications: boolean
  /** When reminders arrive, 'HH:MM'. */
  notifyTime: string
  defaultNotify: number | null
  checkUpdates: boolean
  lastSeenVersion: string
}

export interface Rates {
  /** Units of each currency per 1 USD. */
  perUsd: Record<string, number>
  fetchedAt: number
}

export interface AppData {
  version: 1
  subs: Subscription[]
  lists: List[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  settings: Settings
  rates: Rates
}
