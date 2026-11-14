import { useShallow } from 'zustand/react/shallow'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import { formatMoney } from '../lib/currency'
import { useTab } from '../lib/layout'
import { isActive, monthlyCost } from '../lib/dates'
import { convert } from '../lib/currency'
import { useStore } from '../lib/store'
import { useSyncBusy } from '../lib/syncRunner'
import { TABS, type TabKey } from './TabBar'
import { colors } from './theme'

/** The desktop app's navigation, on the left of the window. */
export function Sidebar({ onTab, onAdd }: { onTab: (t: TabKey) => void; onAdd: () => void }) {
  const tab = useTab((s) => s.tab)
  const { subs, settings, rates, sync } = useStore(useShallow((s) => ({ subs: s.subs, settings: s.settings, rates: s.rates, sync: s.sync })))
  const syncing = useSyncBusy()
  const active = subs.filter(isActive)
  const monthly = active.reduce((sum, s) => sum + convert(monthlyCost(s), s.currency, settings.currency, rates), 0)
  return (
    <View style={{ width: 232, backgroundColor: colors.cardHi, borderRightWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, marginBottom: 26 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 30, height: 30, borderRadius: 8 }} />
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '700', marginLeft: 10 }}>OnTrack</Text>
      </View>
      {TABS.map((t) => {
        const on = t.key === tab
        return (
          <Pressable
            key={t.key}
            onPress={() => onTab(t.key)}
            style={(state) => ({
              flexDirection: 'row',
              alignItems: 'center',
              height: 40,
              borderRadius: 10,
              paddingHorizontal: 10,
              marginBottom: 4,
              backgroundColor: on ? colors.accentSoft : (state as { hovered?: boolean }).hovered || state.pressed ? 'rgba(255,255,255,0.05)' : 'transparent'
            })}
          >
            <Ionicons name={t.icon} size={18} color={on ? colors.accentHi : colors.dim} />
            <Text style={{ color: on ? colors.text : colors.dim, fontSize: 15, fontWeight: on ? '600' : '500', marginLeft: 12 }}>{t.label}</Text>
          </Pressable>
        )
      })}
      <Pressable onPress={onAdd} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 10, backgroundColor: colors.accent, marginTop: 18, opacity: pressed ? 0.75 : 1 })}>
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '600', marginLeft: 6 }}>Add subscription</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 6 }}>
        <Text style={{ color: colors.dim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Per month</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 2 }}>{formatMoney(monthly, settings.currency)}</Text>
        <Text style={{ color: colors.dim, fontSize: 13, marginTop: 2 }}>{`${active.length} active subscriptions`}</Text>
        {sync.enabled && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Ionicons name={sync.error ? 'cloud-offline-outline' : 'cloud-done-outline'} size={14} color={sync.error ? colors.danger : colors.dim} />
            <Text style={{ color: colors.dim, fontSize: 12, marginLeft: 6 }}>{syncing ? 'Syncing…' : sync.error ? 'Sync needs attention' : 'Synced with Google'}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
