import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useState } from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import type { Logo as LogoT } from '../lib/types'

/** A brand's logo from its website (Google's favicon service, which serves large icons for most sites). */
export const logoUrl = (domain: string, size = 128): string =>
  `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=${size}`

/** Black or white text, whichever reads better on `bg`. */
export function onColor(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length < 6) return '#fff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111' : '#fff'
}

interface Props {
  logo: LogoT | null
  name: string
  color: string
  size?: number
  style?: ViewStyle
}

/** A subscription's round logo: an official SVGL logo, a website's icon, an icon, an emoji, an uploaded image, or its initial. */
export function Logo({ logo, name, color, size = 40, style }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const base: ViewStyle = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: color }
  if (logo?.kind === 'svg' && failed !== logo.light) {
    // Vector logos sit on a white disc with room around them, in their light-background version
    // (every SVGL logo has one that reads on white; not all of them read on a dark disc).
    return (
      <View style={[base, { backgroundColor: '#ffffff' }, style]}>
        <Image source={{ uri: logo.light }} style={{ width: size * 0.62, height: size * 0.62 }} contentFit="contain" onError={() => setFailed(logo.light)} transition={120} />
      </View>
    )
  }
  const src = logo?.kind === 'domain' ? logoUrl(logo.domain, size > 48 ? 256 : 128) : logo?.kind === 'image' ? logo.uri : null
  if (src && failed !== src) {
    return (
      <View style={[base, { backgroundColor: '#fff' }, style]}>
        <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" onError={() => setFailed(src)} transition={120} />
      </View>
    )
  }
  if (logo?.kind === 'icon')
    return (
      <View style={[base, { backgroundColor: logo.color }, style]}>
        <MaterialCommunityIcons name={logo.name as never} size={size * 0.55} color={onColor(logo.color)} />
      </View>
    )
  if (logo?.kind === 'emoji')
    return (
      <View style={[base, { backgroundColor: logo.color }, style]}>
        <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.75 }}>{logo.emoji}</Text>
      </View>
    )
  return (
    <View style={[base, style]}>
      <Text style={{ color: onColor(color), fontWeight: '700', fontSize: size * 0.42 }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  )
}
