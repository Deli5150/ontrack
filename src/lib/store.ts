import { create } from 'zustand'
import { convert, fetchRates } from './currency'
import { today } from './dates'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, emptyData, newId } from './defaults'
import { loadData, saveData } from './storage'
import { emptyMeta, stampChanges, type SyncMeta } from './sync'
import type { AppData, Category, List, PaymentMethod, Settings, Subscription } from './types'

// All of OnTrack's data in one store, saved (shortly after each change) as a single JSON document.

interface Store extends AppData {
  loaded: boolean
  /** Sync with Google's bookkeeping for this device (saved with the data, never exported). */
  sync: SyncMeta
  hydrate(): Promise<void>
  addSub(sub: Omit<Subscription, 'id' | 'createdAt'>): Subscription
  updateSub(id: string, patch: Partial<Subscription>): void
  deleteSub(id: string): void
  setSettings(patch: Partial<Settings>): void
  saveList(list: List): void
  deleteList(id: string): void
  saveCategory(c: Category): void
  deleteCategory(id: string): void
  savePaymentMethod(p: PaymentMethod): void
  deletePaymentMethod(id: string): void
  replaceAll(data: AppData): void
  eraseAll(): void
  refreshRates(): Promise<void>
}

const upsert = <T extends { id: string }>(items: T[], item: T): T[] =>
  items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item]

/** Fills in anything an older or hand-edited file is missing. */
export function normalize(raw: Partial<AppData>): AppData {
  const base = emptyData()
  const data: AppData = {
    version: 1,
    subs: Array.isArray(raw.subs) ? raw.subs : [],
    lists: Array.isArray(raw.lists) && raw.lists.length ? raw.lists : base.lists,
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : DEFAULT_CATEGORIES,
    paymentMethods: Array.isArray(raw.paymentMethods) ? raw.paymentMethods : [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    rates: raw.rates?.perUsd ? raw.rates : base.rates
  }
  data.subs = data.subs.map((s) => ({
    ...s,
    logo: s.logo ?? null,
    color: s.color ?? '#3b3650',
    currency: s.currency ?? data.settings.currency,
    type: s.type ?? 'recurring',
    cycle: s.cycle ?? { every: 1, unit: 'month' },
    duration: s.duration ?? { kind: 'forever' },
    freeTrial: Boolean(s.freeTrial),
    listId: data.lists.some((l) => l.id === s.listId) ? s.listId : data.lists[0].id,
    categoryId: s.categoryId ?? 'other',
    paymentMethodId: s.paymentMethodId ?? null,
    notify: s.notify === undefined ? 1 : s.notify,
    priceHistory: s.priceHistory?.length ? s.priceHistory : [{ date: s.startDate, price: s.price }],
    url: s.url ?? '',
    notes: s.notes ?? '',
    cancelledAt: s.cancelledAt ?? null,
    createdAt: s.createdAt ?? Date.now()
  }))
  if (data.settings.listId !== 'all' && !data.lists.some((l) => l.id === data.settings.listId)) data.settings.listId = data.lists[0].id
  return data
}

const dataOf = (s: Store): AppData => ({
  version: 1,
  subs: s.subs,
  lists: s.lists,
  categories: s.categories,
  paymentMethods: s.paymentMethods,
  settings: s.settings,
  rates: s.rates
})

export const useStore = create<Store>((set, get) => ({
  ...emptyData(),
  loaded: false,
  sync: emptyMeta(),

  async hydrate() {
    try {
      const json = await loadData()
      if (json) {
        const raw = JSON.parse(json) as Partial<AppData> & { sync?: SyncMeta }
        set({ ...normalize(raw), sync: { ...emptyMeta(), ...raw.sync } })
      }
    } catch (e) {
      console.warn('OnTrack: could not read saved data', e)
    }
    set({ loaded: true })
    void get().refreshRates()
  },

  addSub(sub) {
    const full: Subscription = { ...sub, id: newId(), createdAt: Date.now() }
    set((s) => ({ subs: [...s.subs, full] }))
    return full
  },
  updateSub(id, patch) {
    set((s) => ({ subs: s.subs.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  },
  deleteSub(id) {
    set((s) => ({ subs: s.subs.filter((x) => x.id !== id) }))
  },
  setSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
  },
  saveList(list) {
    set((s) => ({ lists: upsert(s.lists, list) }))
  },
  deleteList(id) {
    set((s) => {
      const lists = s.lists.filter((l) => l.id !== id)
      if (!lists.length) return s
      const fallback = lists[0].id
      return {
        lists,
        subs: s.subs.map((x) => (x.listId === id ? { ...x, listId: fallback } : x)),
        settings: s.settings.listId === id ? { ...s.settings, listId: fallback } : s.settings
      }
    })
  },
  saveCategory(c) {
    set((s) => ({ categories: upsert(s.categories, c) }))
  },
  deleteCategory(id) {
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id), subs: s.subs.map((x) => (x.categoryId === id ? { ...x, categoryId: 'other' } : x)) }))
  },
  savePaymentMethod(p) {
    set((s) => ({ paymentMethods: upsert(s.paymentMethods, p) }))
  },
  deletePaymentMethod(id) {
    set((s) => ({
      paymentMethods: s.paymentMethods.filter((p) => p.id !== id),
      subs: s.subs.map((x) => (x.paymentMethodId === id ? { ...x, paymentMethodId: null } : x))
    }))
  },
  replaceAll(data) {
    set({ ...normalize(data) })
  },
  eraseAll() {
    // With Sync on, erasing is recorded as deletions, so it reaches the other devices too.
    set({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, lastSeenVersion: get().settings.lastSeenVersion } })
  },
  async refreshRates() {
    if (Date.now() - get().rates.fetchedAt < 12 * 3600_000) return
    const rates = await fetchRates()
    if (rates) set({ rates })
  }
}))

/** Set while applying what Sync downloaded, so those changes aren't stamped as this device's. */
let applyingSync = false
export function applySynced(patch: Partial<Store>): void {
  applyingSync = true
  try {
    useStore.setState(patch)
  } finally {
    applyingSync = false
  }
}

const changeListeners = new Set<() => void>()
/** Called after this device changes something that syncs. */
export const onLocalChange = (fn: () => void): (() => void) => (changeListeners.add(fn), () => changeListeners.delete(fn))

// Note what changed for Sync, and save shortly after changes.
let timer: ReturnType<typeof setTimeout> | null = null
useStore.subscribe((state, prev) => {
  if (!state.loaded || !prev.loaded) return
  if (!applyingSync) {
    const stamped = stampChanges(prev, state, state.sync)
    if (stamped) {
      useStore.setState({ sync: stamped })
      changeListeners.forEach((fn) => fn())
      return
    }
  }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const s = useStore.getState()
    void saveData(JSON.stringify({ ...dataOf(s), sync: s.sync }))
  }, 250)
})

export const exportData = (): AppData => dataOf(useStore.getState())

/** Converts an amount into the preferred currency. */
export function toPreferred(amount: number, from: string): number {
  const { settings, rates } = useStore.getState()
  return convert(amount, from, settings.currency, rates)
}

/** Subscriptions in the chosen list (or all of them). */
export function subsInList(subs: Subscription[], listId: string): Subscription[] {
  return listId === 'all' ? subs : subs.filter((s) => s.listId === listId)
}

/** A blank subscription for the add form. */
export function blankSub(settings: Settings): Omit<Subscription, 'id' | 'createdAt'> {
  const start = today()
  return {
    name: '',
    logo: null,
    color: '#3b3650',
    price: 0,
    currency: settings.currency,
    startDate: start,
    type: 'recurring',
    cycle: { every: 1, unit: 'month' },
    duration: { kind: 'forever' },
    freeTrial: false,
    listId: settings.listId === 'all' ? 'personal' : settings.listId,
    categoryId: 'other',
    paymentMethodId: null,
    notify: settings.defaultNotify,
    priceHistory: [],
    url: '',
    notes: '',
    cancelledAt: null
  }
}
