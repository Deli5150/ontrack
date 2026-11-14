import { DEFAULT_RATES } from './currency'
import type { AppData, Category, Settings } from './types'

export const CATEGORY_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#78716c', '#64748b']

const cat = (id: string, name: string, color: string): Category => ({ id, name, color })

export const DEFAULT_CATEGORIES: Category[] = [
  cat('streaming', 'Streaming', '#ef4444'),
  cat('music', 'Music', '#22c55e'),
  cat('ai', 'AI', '#f97316'),
  cat('software', 'Software', '#3b82f6'),
  cat('gaming', 'Gaming', '#8b5cf6'),
  cat('news', 'News & Reading', '#78716c'),
  cat('health', 'Health & Fitness', '#14b8a6'),
  cat('shopping', 'Shopping & Food', '#f59e0b'),
  cat('phone', 'Phone & Internet', '#06b6d4'),
  cat('social', 'Social', '#ec4899'),
  cat('education', 'Education', '#84cc16'),
  cat('finance', 'Finance', '#6366f1'),
  cat('insurance', 'Insurance', '#64748b'),
  cat('housing', 'Housing & Utilities', '#eab308'),
  cat('transport', 'Transportation', '#a855f7'),
  cat('other', 'Other', '#94a3b8')
]

/** The default category for a catalog group name. */
export function categoryIdFor(group: string): string {
  return DEFAULT_CATEGORIES.find((c) => c.name === group)?.id ?? 'other'
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  listId: 'personal',
  sort: 'next',
  sortAsc: true,
  cancelledOpen: true,
  notifications: true,
  notifyTime: '09:00',
  defaultNotify: 1,
  checkUpdates: true,
  lastSeenVersion: '',
  theme: 'graphite',
  wallpaper: 'glow',
  wallpaperDim: 0.55,
  skippedVersion: '',
  laterVersion: '',
  laterUntil: 0
}

export const emptyData = (): AppData => ({
  version: 1,
  subs: [],
  lists: [
    { id: 'personal', name: 'Personal' },
    { id: 'business', name: 'Business' }
  ],
  categories: DEFAULT_CATEGORIES,
  paymentMethods: [],
  settings: DEFAULT_SETTINGS,
  rates: DEFAULT_RATES
})

export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
