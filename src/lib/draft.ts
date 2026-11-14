import { create } from 'zustand'
import { findService } from '../data/catalog'
import { categoryIdFor } from './defaults'
import { today as todayStr } from './dates'
import type { Draft } from './parse'
import { blankSub, useStore } from './store'
import type { Subscription } from './types'

// The subscription being added or edited, shared by the edit form and the screens it opens (logo,
// price history, payment method), plus subscriptions found by an import, waiting to be reviewed.

export type SubDraft = Omit<Subscription, 'id' | 'createdAt'>

interface DraftState {
  sub: SubDraft
  /** The subscription being edited, or null when adding. */
  editingId: string | null
  found: Draft[]
  set(patch: Partial<SubDraft>): void
}

export const useDraft = create<DraftState>((set) => ({
  sub: blankSub(useStore.getState().settings),
  editingId: null,
  found: [],
  set: (patch) => set((s) => ({ sub: { ...s.sub, ...patch } }))
}))

function defaultListId(): string {
  const { settings, lists } = useStore.getState()
  return settings.listId !== 'all' && lists.some((l) => l.id === settings.listId) ? settings.listId : lists[0].id
}

/** Starts a new subscription, optionally filled in from a catalog service or a parsed draft. */
export function startNew(from?: Partial<SubDraft>): void {
  const base = { ...blankSub(useStore.getState().settings), listId: defaultListId() }
  useDraft.setState({ sub: { ...base, ...from }, editingId: null })
}

export function startEdit(sub: Subscription): void {
  const { id: _id, createdAt: _c, ...rest } = sub
  useDraft.setState({ sub: rest, editingId: sub.id })
}

/** A parsed draft as subscription fields. */
export function fromParsed(d: Draft): Partial<SubDraft> {
  const svc = d.service ?? findService(d.name)
  return {
    name: d.name,
    price: d.price,
    currency: d.currency,
    cycle: d.cycle,
    startDate: d.date ?? useDraft.getState().sub.startDate,
    logo: svc ? { kind: 'domain', domain: svc.domain } : null,
    color: svc?.color ?? '#3b3650',
    categoryId: svc ? categoryIdFor(svc.category) : d.categoryId,
    url: svc?.domain ?? ''
  }
}

/** Saves the draft: adds it, or updates the one being edited (noting a price change in its history). */
export function commitDraft(): void {
  const { sub, editingId } = useDraft.getState()
  const store = useStore.getState()
  const clean: SubDraft = { ...sub, name: sub.name.trim() || 'Subscription', url: sub.url.trim(), notes: sub.notes }
  let history = [...clean.priceHistory].sort((a, b) => (a.date < b.date ? -1 : 1))
  const last = history[history.length - 1]
  if (!last) history = [{ date: clean.startDate, price: clean.price }]
  else if (last.price !== clean.price) {
    // A new price applies from today (or from the first payment, for one that hasn't started).
    const from = editingId ? (clean.startDate > todayStr() ? clean.startDate : todayStr()) : clean.startDate
    history = [...history.filter((p) => p.date < from), { date: from, price: clean.price }]
  }
  if (history[0] && history[0].date > clean.startDate) history[0] = { ...history[0], date: clean.startDate }
  clean.priceHistory = history
  if (editingId) store.updateSub(editingId, clean)
  else store.addSub(clean)
}

/** Adds several parsed subscriptions at once (from an import). */
export function addParsed(drafts: Draft[]): void {
  const store = useStore.getState()
  for (const d of drafts) {
    const base = { ...blankSub(store.settings), listId: defaultListId(), ...fromParsed(d) }
    store.addSub({ ...base, priceHistory: [{ date: base.startDate, price: base.price }] })
  }
}
