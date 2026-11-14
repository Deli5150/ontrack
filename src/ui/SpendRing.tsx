import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import type { Logo as LogoT } from '../lib/types'
import { Logo } from './Logo'
import { colors } from './theme'

// The home screen's chart: a ring split into one arc per active subscription, its length the share
// of the monthly total. One colour (the theme's accent) with small gaps between arcs; tapping an
// arc picks it out and shows that subscription in the middle. Very small ones share an "Other" arc.

export interface RingItem {
  id: string
  name: string
  /** Monthly cost in the preferred currency. */
  cost: number
  logo: LogoT | null
  color: string
}

interface Props {
  items: RingItem[]
  size: number
  selected: string | null
  onSelect: (id: string | null) => void
  /** Formats an amount in the preferred currency. */
  money: (n: number) => string
}

const GAP_DEG = 2.4
const MIN_SHARE = 0.018
const OTHER = '__other'

function arc(cx: number, cy: number, r: number, start: number, end: number): string {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  }
  return `M ${p(start)} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${p(end)}`
}

export function SpendRing({ items, size, selected, onSelect, money }: Props) {
  const total = items.reduce((s, i) => s + i.cost, 0)
  const stroke = Math.round(size * 0.085)
  const r = size / 2 - stroke / 2 - 2
  const c = size / 2

  const segments = useMemo(() => {
    if (total <= 0) return []
    const sorted = [...items].filter((i) => i.cost > 0).sort((a, b) => b.cost - a.cost)
    const big = sorted.filter((i) => i.cost / total >= MIN_SHARE)
    const small = sorted.filter((i) => i.cost / total < MIN_SHARE)
    const parts = big.map((i) => ({ id: i.id, cost: i.cost }))
    if (small.length) parts.push({ id: OTHER, cost: small.reduce((s, i) => s + i.cost, 0) })
    const gap = parts.length > 1 ? GAP_DEG : 0
    let at = 0
    return parts.map((p) => {
      const sweep = (p.cost / total) * 360
      const seg = { id: p.id, start: at + gap / 2, end: at + Math.max(sweep - gap / 2, gap / 2 + 0.5) }
      at += sweep
      return seg
    })
  }, [items, total])

  const pick = selected ? items.find((i) => i.id === selected) : null
  const otherItems = items.filter((i) => total > 0 && i.cost / total < MIN_SHARE)

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <G>
          {segments.map((s) => {
            const on = selected === s.id || (selected === OTHER && s.id === OTHER)
            const full = s.end - s.start >= 359.5
            return full ? (
              <Circle key={s.id} cx={c} cy={c} r={r} stroke={colors.accent} strokeWidth={stroke} fill="none" onPress={() => onSelect(selected === s.id ? null : s.id)} />
            ) : (
              <Path
                key={s.id}
                d={arc(c, c, r, s.start, s.end)}
                stroke={colors.accent}
                strokeOpacity={selected && !on ? 0.28 : 1}
                strokeWidth={on ? stroke + 6 : stroke}
                strokeLinecap="butt"
                fill="none"
                onPress={() => onSelect(selected === s.id ? null : s.id)}
              />
            )
          })}
        </G>
      </Svg>
      <Pressable onPress={() => onSelect(null)} style={{ position: 'absolute', left: stroke * 2, right: stroke * 2, top: stroke * 2, bottom: stroke * 2, alignItems: 'center', justifyContent: 'center' }}>
        {pick ? (
          <>
            <Logo logo={pick.logo} name={pick.name} color={pick.color} size={44} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 10 }} numberOfLines={1}>
              {pick.name}
            </Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 2 }}>{money(pick.cost)}</Text>
            <Text style={{ color: colors.dim, fontSize: 14 }}>{`${Math.round((pick.cost / total) * 100)}% of your monthly total`}</Text>
          </>
        ) : selected === OTHER ? (
          <>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{`${otherItems.length} smaller`}</Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 2 }}>{money(otherItems.reduce((s, i) => s + i.cost, 0))}</Text>
            <Text style={{ color: colors.dim, fontSize: 14 }} numberOfLines={2}>
              {otherItems.map((i) => i.name).join(', ')}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: colors.dim, fontSize: 14, letterSpacing: 0.3 }}>Per month</Text>
            <Text style={{ color: colors.text, fontSize: size > 300 ? 40 : 32, fontWeight: '700', marginVertical: 2 }} adjustsFontSizeToFit numberOfLines={1}>
              {money(total)}
            </Text>
            <Text style={{ color: colors.dim, fontSize: 14 }}>{`${money(total * 12)} a year`}</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}
