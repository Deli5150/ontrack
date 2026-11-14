import { Ionicons } from '@expo/vector-icons'
import { useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { convert, formatMoney } from '../lib/currency'
import { addMonths, daysInMonth, formatDate, MONTH_NAMES, paymentsBetween, priceOn, today } from '../lib/dates'
import { startEdit } from '../lib/draft'
import { subsInList, useStore } from '../lib/store'
import type { Subscription } from '../lib/types'
import { useRootNav } from '../nav'
import { Backdrop, Column, Pill } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { closeSheet, showSheet } from '../ui/overlays'
import { colors } from '../ui/theme'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Payment {
  sub: Subscription
  date: string
  amount: number
}

export default function Calendar() {
  const nav = useRootNav()
  const insets = useSafeAreaInsets()
  const { subs, settings, rates } = useStore()
  const t = today()
  const [month, setMonth] = useState(t.slice(0, 8) + '01')
  const [y, m] = month.split('-').map(Number)
  const isThisMonth = month.slice(0, 7) === t.slice(0, 7)

  const days = daysInMonth(y, m - 1)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7

  const byDay = useMemo(() => {
    const end = `${month.slice(0, 8)}${String(days).padStart(2, '0')}`
    const map = new Map<string, Payment[]>()
    for (const sub of subsInList(subs, settings.listId)) {
      for (const date of paymentsBetween(sub, month, end)) {
        const amount = convert(priceOn(sub, date), sub.currency, settings.currency, rates)
        map.set(date, [...(map.get(date) ?? []), { sub, date, amount }])
      }
    }
    return map
  }, [subs, settings.listId, settings.currency, rates, month, days])

  const all = [...byDay.values()].flat()
  const total = all.reduce((s, p) => s + p.amount, 0)
  const upcoming = all.filter((p) => p.date >= t).reduce((s, p) => s + p.amount, 0)

  const go = (n: number) => setMonth((cur) => addMonths(cur, n, 1))
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) go(1)
        else if (g.dx > 50) go(-1)
      }
    })
  ).current

  const openDay = (date: string) => {
    const list = byDay.get(date)
    if (!list?.length) return
    showSheet(
      <View style={{ backgroundColor: colors.cardHi, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{formatDate(date)}</Text>
        <Text style={{ color: colors.dim, marginBottom: 10 }}>{formatMoney(list.reduce((s, p) => s + p.amount, 0), settings.currency)}</Text>
        {list.map((p) => (
          <Pressable
            key={p.sub.id}
            onPress={() => {
              closeSheet()
              startEdit(p.sub)
              setTimeout(() => nav.navigate('Flow', { screen: 'Edit' }), 250)
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
          >
            <Logo logo={p.sub.logo} name={p.sub.name} color={p.sub.color} size={34} />
            <Text style={{ color: colors.text, fontSize: 16, flex: 1, marginLeft: 12 }}>{p.sub.name}</Text>
            <Text style={{ color: colors.text, fontSize: 16 }}>{formatMoney(priceOn(p.sub, date), p.sub.currency)}</Text>
          </Pressable>
        ))}
      </View>
    )
  }

  const cells = [...Array.from({ length: lead }, () => 0), ...Array.from({ length: days }, (_, i) => i + 1)]
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }}>
        <Column>
          <View style={{ height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <Pressable onPress={() => go(-1)} hitSlop={10} style={arrow} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => go(1)} hitSlop={10} style={arrow} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
            {!isThisMonth && <Pill label="Today" onPress={() => setMonth(t.slice(0, 8) + '01')} />}
          </View>
          <View {...pan.panHandlers}>
            <Text style={{ color: colors.text, fontSize: 34, fontWeight: '700', marginTop: 18 }}>
              {MONTH_NAMES[m - 1]}
              {y !== Number(t.slice(0, 4)) ? <Text style={{ color: colors.dim }}> {y}</Text> : null}
            </Text>
            <Text style={{ fontSize: 16, marginTop: 4, marginBottom: 18 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{formatMoney(total, settings.currency)}</Text>
              <Text style={{ color: colors.dim }}> Total   </Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{formatMoney(upcoming, settings.currency)}</Text>
              <Text style={{ color: colors.dim }}> Upcoming</Text>
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 15 }}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}>
              {cells.map((d, i) => {
                const date = d ? `${month.slice(0, 8)}${String(d).padStart(2, '0')}` : ''
                const list = d ? (byDay.get(date) ?? []) : []
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    {d > 0 && (
                      <Pressable
                        onPress={() => openDay(date)}
                        style={({ pressed }) => ({ height: 74, borderRadius: 10, backgroundColor: date === t ? colors.today : pressed ? colors.cardHi : colors.card, alignItems: 'center', paddingTop: 5 })}
                      >
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: date === t ? '700' : '400' }}>{d}</Text>
                        <View style={{ alignItems: 'center', marginTop: 4, gap: 3 }}>
                          {list.slice(0, list.length > 2 ? 1 : 2).map((p) => (
                            <Logo key={p.sub.id} logo={p.sub.logo} name={p.sub.name} color={p.sub.color} size={20} />
                          ))}
                          {list.length > 2 && <Text style={{ color: colors.dim, fontSize: 11, fontWeight: '600' }}>+{list.length - 1}</Text>}
                        </View>
                      </Pressable>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        </Column>
      </ScrollView>
    </View>
  )
}

const arrow = { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' } as const
