import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { IconName } from './kit'
import { colors } from './theme'

import type { TabKey } from '../lib/layout'
export type { TabKey }

export const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'subs', label: 'Subscriptions', icon: 'contrast' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'settings', label: 'Settings', icon: 'settings-sharp' }
]

/** The floating glass bar at the bottom. */
export function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 6, 12), alignItems: 'center' }}>
      <View style={{ borderRadius: 34, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
        <BlurView intensity={40} tint="dark" style={{ flexDirection: 'row', padding: 5, backgroundColor: 'rgba(38,35,48,0.82)' }}>
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <Pressable
                key={t.key}
                onPress={() => onChange(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ width: 92, height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'transparent' }}
              >
                <Ionicons name={t.icon} size={21} color={on ? colors.text : '#d6d3df'} />
                <Text style={{ color: on ? colors.text : '#d6d3df', fontSize: 10.5, fontWeight: '600', marginTop: 3 }}>{t.label}</Text>
              </Pressable>
            )
          })}
        </BlurView>
      </View>
    </View>
  )
}
