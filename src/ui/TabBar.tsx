import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useEffect, useRef } from 'react'
import { Animated, Platform, Pressable, Text, View } from 'react-native'
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
const TAB_W = 92

export function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const insets = useSafeAreaInsets()
  const index = TABS.findIndex((t) => t.key === tab)
  // The highlight slides to the chosen tab.
  const x = useRef(new Animated.Value(index * TAB_W)).current
  useEffect(() => {
    Animated.spring(x, { toValue: index * TAB_W, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 260, mass: 0.8 }).start()
  }, [index, x])
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 6, 12), alignItems: 'center' }}>
      <View style={{ borderRadius: 34, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
        <BlurView intensity={40} tint="dark" style={{ flexDirection: 'row', padding: 5, backgroundColor: 'rgba(38,35,48,0.82)' }}>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 5, top: 5, width: TAB_W, height: 54, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ translateX: x }] }} />
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <Pressable
                key={t.key}
                onPress={() => onChange(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ width: TAB_W, height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
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
