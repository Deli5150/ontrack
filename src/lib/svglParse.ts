// Reads SVGL's logo list (its source file src/data/svgs.ts, a list of object literals) without
// running it: each entry's title, sub-title, icon file(s) and website.

export interface SvglLogo {
  title: string
  /** The icon for light backgrounds and for dark ones (often the same file). */
  light: string
  dark: string
  url: string
}

const str = (body: string, key: string): string | undefined => new RegExp(`\\b${key}:\\s*"([^"]*)"`).exec(body)?.[1]

export function parseSvgl(source: string): SvglLogo[] {
  const out: SvglLogo[] = []
  for (const body of source.split(/\n\s{2}\{\s*\n/).slice(1)) {
    const title = str(body, 'title')
    if (!title) continue
    const single = /\broute:\s*"([^"]+)"/.exec(body)?.[1]
    const pair = /\broute:\s*\{\s*light:\s*"([^"]+)",\s*dark:\s*"([^"]+)"/.exec(body)
    const light = single ?? pair?.[1]
    const dark = single ?? pair?.[2]
    if (!light || !dark) continue
    const sub = str(body, 'subTitle')
    out.push({ title: sub ? `${title} (${sub})` : title, light, dark, url: str(body, 'url') ?? '' })
  }
  return out
}
