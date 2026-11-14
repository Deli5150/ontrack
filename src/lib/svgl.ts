import AsyncStorage from '@react-native-async-storage/async-storage'
import BUNDLED from '../data/svgl.json'
import type { Logo } from './types'
import { parseSvgl, type SvglLogo } from './svglParse'

// Official brand logos from SVGL (svgl.app). Its API sits behind a bot check that apps can't pass,
// so the list and the SVG files come from SVGL's GitHub repo through jsDelivr. A copy of the list
// ships with the app (src/data/svgl.json, scripts/svgl.mjs) and a newer one is fetched weekly.

const CDN = 'https://cdn.jsdelivr.net/gh/pheralb/svgl@main'
const KEY = 'ontrack:svgl'
const WEEK = 7 * 86_400_000

let logos: SvglLogo[] = BUNDLED as SvglLogo[]

export const svglFile = (route: string): string => `${CDN}/static${route}`

const norm = (t: string): string => t.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '')
const host = (url: string): string => url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()

export const svglLogo = (l: SvglLogo): Logo => ({ kind: 'svg', light: svglFile(l.light), dark: svglFile(l.dark) })

/** Logos whose name or website matches what was typed, best matches first. */
export function searchSvgl(query: string, limit = 24): SvglLogo[] {
  const q = norm(query)
  if (!q) return []
  const scored: Array<[number, SvglLogo]> = []
  for (const l of logos) {
    const t = norm(l.title)
    const h = host(l.url)
    const score = t === q ? 0 : t.startsWith(q) ? 1 : h.startsWith(q) ? 2 : t.includes(q) ? 3 : h.includes(q) ? 4 : -1
    if (score >= 0) scored.push([score, l])
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].title.length - b[1].title.length)
    .slice(0, limit)
    .map(([, l]) => l)
}

/** The SVGL logo for a service: same name, or same website. */
export function svglFor(name: string, domain?: string): SvglLogo | null {
  const n = norm(name)
  const d = domain?.replace(/^www\./, '').toLowerCase()
  return logos.find((l) => !l.title.includes('(') && norm(l.title) === n) ?? (d ? logos.find((l) => !l.title.includes('(') && host(l.url) === d) : undefined) ?? null
}

/** Uses the saved list, and fetches a fresh one when it's a week old. */
export async function refreshSvgl(): Promise<void> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as { at: number; logos: SvglLogo[] } | null
    if (saved?.logos?.length) logos = saved.logos
    if (saved && Date.now() - saved.at < WEEK) return
    const res = await fetch(`${CDN}/src/data/svgs.ts`)
    if (!res.ok) return
    const fresh = parseSvgl(await res.text())
    if (fresh.length < 300) return
    logos = fresh
    await AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), logos: fresh }))
  } catch {}
}

/** A brand's logo: its official SVGL logo when there is one, else its website's icon. */
export function brandLogo(name: string, domain?: string): Logo | null {
  const l = svglFor(name, domain)
  if (l) return svglLogo(l)
  return domain ? { kind: 'domain', domain } : null
}
