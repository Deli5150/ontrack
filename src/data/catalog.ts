// Popular services shown when adding a subscription: name, website (for the logo), brand color,
// category and a typical monthly US price to start from.

export interface Service {
  name: string
  domain: string
  color: string
  category: string
  price: number
  /** Billed yearly rather than monthly. */
  yearly?: boolean
}

const s = (name: string, domain: string, color: string, price: number, yearly?: boolean) => ({ name, domain, color, price, yearly })

const GROUPS: Record<string, ReturnType<typeof s>[]> = {
  Streaming: [
    s('Netflix', 'netflix.com', '#000000', 17.99),
    s('YouTube Premium', 'youtube.com', '#ffffff', 13.99),
    s('Amazon Prime Video', 'primevideo.com', '#00a8e1', 8.99),
    s('Disney+', 'disneyplus.com', '#0b1b5c', 11.99),
    s('Hulu', 'hulu.com', '#1ce783', 11.99),
    s('HBO Max', 'hbomax.com', '#002be7', 16.99),
    s('Apple TV+', 'tv.apple.com', '#000000', 12.99),
    s('Paramount+', 'paramountplus.com', '#0064ff', 8.99),
    s('Peacock', 'peacocktv.com', '#000000', 10.99),
    s('Crunchyroll', 'crunchyroll.com', '#f47521', 7.99),
    s('ESPN+', 'plus.espn.com', '#000000', 11.99),
    s('YouTube TV', 'tv.youtube.com', '#ffffff', 82.99),
    s('Sling TV', 'sling.com', '#0b72e7', 45.99),
    s('Fubo', 'fubo.tv', '#fa4616', 84.99),
    s('Discovery+', 'discoveryplus.com', '#0073e6', 5.99),
    s('Starz', 'starz.com', '#000000', 10.99),
    s('MGM+', 'mgmplus.com', '#000000', 6.99),
    s('Twitch Turbo', 'twitch.tv', '#9146ff', 11.99),
    s('Plex Pass', 'plex.tv', '#e5a00d', 6.99),
    s('Mubi', 'mubi.com', '#001489', 14.99)
  ],
  Music: [
    s('Spotify', 'spotify.com', '#1db954', 11.99),
    s('Apple Music', 'music.apple.com', '#fa243c', 10.99),
    s('YouTube Music', 'music.youtube.com', '#ff0000', 10.99),
    s('Amazon Music Unlimited', 'music.amazon.com', '#25d1da', 10.99),
    s('Tidal', 'tidal.com', '#000000', 10.99),
    s('Deezer', 'deezer.com', '#a238ff', 11.99),
    s('SoundCloud Go+', 'soundcloud.com', '#ff5500', 10.99),
    s('Pandora', 'pandora.com', '#3668ff', 10.99),
    s('Audible', 'audible.com', '#f8991c', 14.95),
    s('SiriusXM', 'siriusxm.com', '#0000eb', 10.99)
  ],
  'AI': [
    s('ChatGPT Plus', 'chatgpt.com', '#000000', 20),
    s('Claude Pro', 'claude.ai', '#d97757', 20),
    s('Google AI Pro', 'gemini.google.com', '#4285f4', 19.99),
    s('Perplexity Pro', 'perplexity.ai', '#20808d', 20),
    s('Midjourney', 'midjourney.com', '#000000', 10),
    s('Cursor', 'cursor.com', '#000000', 20),
    s('GitHub Copilot', 'github.com', '#000000', 10),
    s('Grok / X Premium+', 'x.ai', '#000000', 40),
    s('ElevenLabs', 'elevenlabs.io', '#000000', 5),
    s('T3 Chat', 't3.chat', '#e94ca2', 8)
  ],
  Software: [
    s('iCloud+', 'icloud.com', '#3693f3', 2.99),
    s('Google One', 'one.google.com', '#4285f4', 1.99),
    s('Microsoft 365', 'microsoft.com', '#ea3e23', 9.99),
    s('Dropbox', 'dropbox.com', '#0061ff', 11.99),
    s('Adobe Creative Cloud', 'adobe.com', '#fa0f00', 59.99),
    s('Notion', 'notion.so', '#000000', 10),
    s('Canva Pro', 'canva.com', '#7d2ae8', 14.99),
    s('Figma', 'figma.com', '#0acf83', 16),
    s('1Password', '1password.com', '#0572ec', 2.99),
    s('Bitwarden', 'bitwarden.com', '#175ddc', 1.65),
    s('NordVPN', 'nordvpn.com', '#4687ff', 12.99),
    s('ExpressVPN', 'expressvpn.com', '#da3940', 12.95),
    s('Proton', 'proton.me', '#6d4aff', 9.99),
    s('Grammarly', 'grammarly.com', '#15c39a', 12),
    s('Todoist', 'todoist.com', '#e44332', 4),
    s('Evernote', 'evernote.com', '#00a82d', 14.99),
    s('Setapp', 'setapp.com', '#000000', 9.99),
    s('Raycast Pro', 'raycast.com', '#ff6363', 8),
    s('CleanMyMac', 'macpaw.com', '#000000', 3.35),
    s('Zoom', 'zoom.us', '#0b5cff', 13.33),
    s('Slack', 'slack.com', '#4a154b', 8.75),
    s('Squarespace', 'squarespace.com', '#000000', 16),
    s('GoDaddy', 'godaddy.com', '#1bdbdb', 11.99)
  ],
  Gaming: [
    s('Xbox Game Pass', 'xbox.com', '#107c10', 19.99),
    s('PlayStation Plus', 'playstation.com', '#0070d1', 9.99),
    s('Nintendo Switch Online', 'nintendo.com', '#e60012', 3.99),
    s('GeForce Now', 'nvidia.com', '#76b900', 9.99),
    s('Apple Arcade', 'apple.com', '#000000', 6.99),
    s('EA Play', 'ea.com', '#ff4747', 5.99),
    s('Ubisoft+', 'ubisoft.com', '#000000', 17.99),
    s('Discord Nitro', 'discord.com', '#5865f2', 9.99),
    s('Humble Choice', 'humblebundle.com', '#cc2929', 11.99),
    s('World of Warcraft', 'worldofwarcraft.blizzard.com', '#148eff', 14.99),
    s('Patreon', 'patreon.com', '#ff424d', 5)
  ],
  'News & Reading': [
    s('The New York Times', 'nytimes.com', '#000000', 25),
    s('The Wall Street Journal', 'wsj.com', '#000000', 38.99),
    s('The Washington Post', 'washingtonpost.com', '#000000', 12),
    s('The Athletic', 'theathletic.com', '#000000', 7.99),
    s('Apple News+', 'apple.com', '#fa243c', 12.99),
    s('Medium', 'medium.com', '#000000', 5),
    s('Substack', 'substack.com', '#ff6719', 8),
    s('Kindle Unlimited', 'amazon.com', '#ff9900', 11.99),
    s('Scribd', 'scribd.com', '#1e7b85', 11.99),
    s('The Economist', 'economist.com', '#e3120b', 22)
  ],
  'Health & Fitness': [
    s('Peloton', 'onepeloton.com', '#000000', 24),
    s('Strava', 'strava.com', '#fc4c02', 11.99),
    s('Headspace', 'headspace.com', '#ff7e1d', 12.99),
    s('Calm', 'calm.com', '#3a67d1', 14.99),
    s('MyFitnessPal', 'myfitnesspal.com', '#0066ee', 19.99),
    s('Planet Fitness', 'planetfitness.com', '#5c2d91', 15),
    s('Fitbit Premium', 'fitbit.com', '#00b0b9', 9.99),
    s('WHOOP', 'whoop.com', '#000000', 30),
    s('Noom', 'noom.com', '#fb513b', 70),
    s('Apple Fitness+', 'apple.com', '#a6ff00', 9.99),
    s('Oura', 'ouraring.com', '#000000', 5.99)
  ],
  'Shopping & Food': [
    s('Amazon Prime', 'amazon.com', '#ff9900', 14.99),
    s('Walmart+', 'walmart.com', '#0071ce', 12.95),
    s('Costco', 'costco.com', '#e31837', 65, true),
    s('DoorDash DashPass', 'doordash.com', '#ff3008', 9.99),
    s('Uber One', 'uber.com', '#000000', 9.99),
    s('Instacart+', 'instacart.com', '#43b02a', 9.99),
    s('Grubhub+', 'grubhub.com', '#ff8000', 9.99),
    s('HelloFresh', 'hellofresh.com', '#91c11e', 60),
    s('Target Circle 360', 'target.com', '#cc0000', 10.99),
    s('Chewy Autoship', 'chewy.com', '#1c49c2', 40)
  ],
  'Phone & Internet': [
    s('Verizon', 'verizon.com', '#cd040b', 80),
    s('T-Mobile', 't-mobile.com', '#e20074', 75),
    s('AT&T', 'att.com', '#00a8e0', 75),
    s('Xfinity', 'xfinity.com', '#000000', 70),
    s('Spectrum', 'spectrum.com', '#0099d8', 80),
    s('Google Fi', 'fi.google.com', '#4285f4', 50),
    s('Mint Mobile', 'mintmobile.com', '#6ebd44', 15),
    s('Visible', 'visible.com', '#1800ff', 25),
    s('Starlink', 'starlink.com', '#000000', 120),
    s('Verizon Fios', 'verizon.com', '#cd040b', 94.99)
  ],
  Social: [
    s('X Premium', 'x.com', '#000000', 8),
    s('LinkedIn Premium', 'linkedin.com', '#0a66c2', 39.99),
    s('Snapchat+', 'snapchat.com', '#fffc00', 3.99),
    s('Telegram Premium', 'telegram.org', '#26a5e4', 4.99),
    s('Tinder', 'tinder.com', '#fd267a', 24.99),
    s('Bumble', 'bumble.com', '#ffc629', 29.99),
    s('Hinge', 'hinge.co', '#000000', 29.99),
    s('Meta Verified', 'meta.com', '#0866ff', 14.99)
  ],
  Education: [
    s('Duolingo Super', 'duolingo.com', '#58cc02', 12.99),
    s('MasterClass', 'masterclass.com', '#000000', 10),
    s('Coursera Plus', 'coursera.org', '#0056d2', 59),
    s('Skillshare', 'skillshare.com', '#00ff84', 13.99),
    s('Brilliant', 'brilliant.org', '#000000', 24.99),
    s('Babbel', 'babbel.com', '#ff6b00', 13.95),
    s('Chegg', 'chegg.com', '#eb7100', 15.95)
  ]
}

export const CATALOG: Record<string, Service[]> = Object.fromEntries(
  Object.entries(GROUPS).map(([category, list]) => [category, list.map((x) => ({ ...x, category }))])
)

export const ALL_SERVICES: Service[] = Object.values(CATALOG).flat()

const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Words that name one service: its full name, plus its website's name and the first word of its
 * name when no other service shares them ("netflix", "spotify"; not "apple" or "the").
 */
const KEYS: Array<[string, Service]> = (() => {
  const short = new Map<string, Service[]>()
  const keys: Array<[string, Service]> = []
  for (const svc of ALL_SERVICES) {
    keys.push([norm(svc.name), svc])
    const site = svc.domain.split('.').slice(-2, -1)[0]
    for (const k of new Set([norm(site), norm(svc.name.split(/[ +/]/)[0])])) {
      if (k.length >= 3) short.set(k, [...(short.get(k) ?? []), svc])
    }
  }
  for (const [k, list] of short) if (list.length === 1 && k !== 'the') keys.push([k, list[0]])
  return keys.sort((a, b) => b[0].length - a[0].length)
})()

/** The catalog service named in `text`, preferring the longest match. */
export function findService(text: string): Service | null {
  const t = norm(text)
  if (!t) return null
  return KEYS.find(([k]) => t.includes(k))?.[1] ?? null
}
