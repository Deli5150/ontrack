import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { convert, formatMoney } from '../lib/currency'
import { cycleShort, isActive, monthlyCost, nextPayment, statusLine } from '../lib/dates'
import { startEdit } from '../lib/draft'
import { subsInList, useStore } from '../lib/store'
import type { SortKey, Subscription } from '../lib/types'
import { useRootNav } from '../nav'
import { Backdrop, CircleButton, Column, Pill } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { Orbit } from '../ui/Orbit'
import { showMenu } from '../ui/overlays'
import { colors } from '../ui/theme'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'next', label: 'Next' },
  { key: 'price', label: 'Price' },
  { key: 'name', label: 'Name' }
]

export function SubRow({ sub, onPress }: { sub: Subscription; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? colors.cardHi : colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 })}
    >
      <Logo logo={sub.logo} name={sub.name} color={sub.color} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }} numberOfLines={1}>
          {sub.name}
        </Text>
        <Text style={{ color: colors.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {statusLine(sub)}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 16, marginLeft: 8 }}>
        {formatMoney(sub.price, sub.currency)}
        {sub.type === 'recurring' && (sub.cycle.unit !== 'month' || sub.cycle.every !== 1) ? <Text style={{ color: colors.dim, fontSize: 12 }}>{cycleShort(sub.cycle)}</Text> : null}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} style={{ marginLeft: 6 }} />
    </Pressable>
  )
}

export default function Home() {
  const nav = useRootNav()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { subs, lists, settings, rates, setSettings } = useStore()

  const inList = useMemo(() => subsInList(subs, settings.listId), [subs, settings.listId])
  const toPref = (s: Subscription, amount: number) => convert(amount, s.currency, settings.currency, rates)

  const { active, inactive } = useMemo(() => {
    const act = inList.filter(isActive)
    const dir = settings.sortAsc ? 1 : -1
    const key = (s: Subscription): string | number =>
      settings.sort === 'next' ? (nextPayment(s) ?? '9999') : settings.sort === 'price' ? convert(monthlyCost(s) || s.price, s.currency, settings.currency, rates) : s.name.toLowerCase()
    act.sort((a, b) => {
      const ka = key(a)
      const kb = key(b)
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir
    })
    const ina = inList.filter((s) => !isActive(s)).sort((a, b) => ((b.cancelledAt ?? '') < (a.cancelledAt ?? '') ? -1 : 1))
    return { active: act, inactive: ina }
  }, [inList, settings.sort, settings.sortAsc, settings.currency, rates])

  const monthly = active.reduce((sum, s) => sum + toPref(s, monthlyCost(s)), 0)
  const inactiveMonthly = inactive.reduce((sum, s) => sum + toPref(s, monthlyCost(s)), 0)
  const listName = settings.listId === 'all' ? 'All lists' : (lists.find((l) => l.id === settings.listId)?.name ?? 'Personal')

  const open = (s: Subscription) => {
    startEdit(s)
    nav.navigate('Flow', { screen: 'Edit' })
  }
  const add = () => nav.navigate('Flow', { screen: 'Catalog' })

  const pickList = () =>
    showMenu('List', [
      ...lists.map((l) => ({ label: l.name, sub: `${subs.filter((s) => s.listId === l.id && isActive(s)).length} active`, selected: settings.listId === l.id, onPress: () => setSettings({ listId: l.id }) })),
      { label: 'All lists', selected: settings.listId === 'all', onPress: () => setSettings({ listId: 'all' }) },
      { label: 'Edit lists…', onPress: () => nav.navigate('Lists') }
    ])

  const pickSort = () =>
    showMenu('Sort by', [
      ...SORTS.map((s) => ({
        label: s.key === 'next' ? 'Next payment' : s.label,
        selected: settings.sort === s.key,
        onPress: () => setSettings({ sort: s.key, sortAsc: s.key === settings.sort ? settings.sortAsc : s.key !== 'price' })
      })),
      { label: settings.sortAsc ? 'Ascending' : 'Descending', sub: 'Tap to reverse', onPress: () => setSettings({ sortAsc: !settings.sortAsc }) }
    ])

  const orbitSize = Math.min(width - 32, 380)
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }}>
        <Column>
          <Orbit size={orbitSize} moons={active.map((s) => ({ id: s.id, cost: toPref(s, monthlyCost(s) || s.price) }))} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, marginBottom: 22 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 38, fontWeight: '700' }}>{active.length}</Text>
              <Pressable onPress={pickList} style={{ flexDirection: 'row', alignItems: 'center' }} hitSlop={8}>
                <Text style={{ color: colors.dim, fontSize: 16 }}>{listName}</Text>
                <Ionicons name="chevron-expand" size={14} color={colors.dim} style={{ marginLeft: 3 }} />
              </Pressable>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.text, fontSize: 30, fontWeight: '700' }}>{formatMoney(monthly, settings.currency)}</Text>
              <Text style={{ color: colors.dim, fontSize: 16 }}>Total monthly</Text>
            </View>
          </View>

          {inList.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>Nothing tracked yet</Text>
              <Text style={{ color: colors.dim, fontSize: 15, textAlign: 'center', marginBottom: 18 }}>Add your subscriptions to see what you spend and get a heads-up before each payment.</Text>
              <Pill label="Add a subscription" tone="accent" onPress={add} />
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
                <Text style={{ color: colors.dim, fontSize: 15, flex: 1 }}>Active</Text>
                <Pressable onPress={pickSort} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.dim, fontSize: 15 }}>{SORTS.find((s) => s.key === settings.sort)?.label}</Text>
                  <Ionicons name="swap-vertical" size={15} color={colors.dim} style={{ marginLeft: 3 }} />
                </Pressable>
              </View>
              {active.map((s) => (
                <SubRow key={s.id} sub={s} onPress={() => open(s)} />
              ))}
              {active.length === 0 && <Text style={{ color: colors.faint, marginBottom: 12 }}>No active subscriptions in this list.</Text>}
              {inactive.length > 0 && (
                <>
                  <Pressable onPress={() => setSettings({ cancelledOpen: !settings.cancelledOpen })} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, paddingHorizontal: 2 }}>
                    <Text style={{ color: colors.dim, fontSize: 15 }}>{inactive.every((s) => s.cancelledAt) ? 'Cancelled' : 'Inactive'}</Text>
                    <Ionicons name={settings.cancelledOpen ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.dim} style={{ marginLeft: 4 }} />
                    <View style={{ flex: 1 }} />
                    <Text style={{ color: colors.dim, fontSize: 15 }}>{formatMoney(inactiveMonthly, settings.currency)}</Text>
                  </Pressable>
                  {settings.cancelledOpen && inactive.map((s) => <SubRow key={s.id} sub={s} onPress={() => open(s)} />)}
                </>
              )}
            </>
          )}
        </Column>
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }} pointerEvents="box-none">
        <Column style={{ alignItems: 'flex-end' }} pointerEvents="box-none">
          <CircleButton icon="add" onPress={add} label="Add subscription" size={42} />
        </Column>
      </View>
    </View>
  )
}
