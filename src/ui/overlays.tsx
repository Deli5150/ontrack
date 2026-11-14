import { Ionicons } from '@expo/vector-icons'
import { useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'
import { addMonths, MONTH_NAMES, today } from '../lib/dates'
import { colors } from './theme'

// App-wide pop-ups opened from anywhere: a menu of choices (also used to confirm), and a date picker.

/** iOS can't present a new pop-up while the last one is still animating away. */
const afterClose = (fn: () => void): void => void (Platform.OS === 'ios' ? setTimeout(fn, 400) : fn())

export interface MenuOption {
  label: string
  sub?: string
  selected?: boolean
  destructive?: boolean
  onPress: () => void
}

interface Overlay {
  menu: { title?: string; message?: string; options: MenuOption[] } | null
  date: { title?: string; value: string; onPick: (d: string) => void } | null
  custom: ReactNode | null
}

const useOverlay = create<Overlay>(() => ({ menu: null, date: null, custom: null }))

export const showMenu = (title: string | undefined, options: MenuOption[], message?: string): void => useOverlay.setState({ menu: { title, options, message } })
export const pickDate = (value: string, onPick: (d: string) => void, title?: string): void => useOverlay.setState({ date: { value, onPick, title } })
export const showSheet = (content: ReactNode): void => useOverlay.setState({ custom: content })
export const closeSheet = (): void => useOverlay.setState({ custom: null })

/** Asks before doing something that can't be undone. */
export function confirm(title: string, message: string, action: string, onConfirm: () => void): void {
  showMenu(title, [{ label: action, destructive: true, onPress: onConfirm }], message)
}

/** A card that rises from the bottom over a dimmed screen. */
export function BottomCard({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 480, padding: 10, paddingBottom: insets.bottom + 10 }}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function MenuView() {
  const menu = useOverlay((s) => s.menu)
  const close = () => useOverlay.setState({ menu: null })
  return (
    <BottomCard visible={!!menu} onClose={close}>
      <View style={{ backgroundColor: colors.cardHi, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        {(menu?.title || menu?.message) && (
          <View style={{ padding: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: colors.separator }}>
            {menu?.title && <Text style={{ color: colors.dim, fontWeight: '600', fontSize: 13 }}>{menu.title}</Text>}
            {menu?.message && <Text style={{ color: colors.dim, fontSize: 13, textAlign: 'center', marginTop: 4 }}>{menu.message}</Text>}
          </View>
        )}
        <ScrollView style={{ maxHeight: 420 }}>
          {menu?.options.map((o, i) => (
            <Pressable
              key={i}
              onPress={() => {
                close()
                afterClose(o.onPress)
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, minHeight: 52, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.separator, backgroundColor: pressed ? colors.field : 'transparent' })}
            >
              <View style={{ width: 24 }}>{o.selected && <Ionicons name="checkmark" size={18} color={colors.accentHi} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: o.destructive ? colors.danger : colors.text, fontSize: 17 }}>{o.label}</Text>
                {o.sub && <Text style={{ color: colors.dim, fontSize: 13 }}>{o.sub}</Text>}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Pressable onPress={close} style={{ backgroundColor: colors.cardHi, borderRadius: 22, marginTop: 8, height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.accentHi, fontSize: 17, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </BottomCard>
  )
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** A month grid to pick one day from. */
export function MonthPicker({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const [month, setMonth] = useState(value.slice(0, 7) + '-01')
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(y, m, 0).getDate()
  const t = today()
  const cells = [...Array.from({ length: lead }, () => 0), ...Array.from({ length: days }, (_, i) => i + 1)]
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 }}>
          {MONTH_NAMES[m - 1]} {y}
        </Text>
        <Pressable hitSlop={10} onPress={() => setMonth(addMonths(month, -1, 1))} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={20} color={colors.accentHi} />
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMonth(addMonths(month, 1, 1))} style={{ padding: 6, marginLeft: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.accentHi} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.faint, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          const date = d ? `${month.slice(0, 8)}${String(d).padStart(2, '0')}` : ''
          const selected = date === value
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              {d > 0 && (
                <Pressable
                  onPress={() => onPick(date)}
                  style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : 'transparent' }}
                >
                  <Text style={{ color: selected ? colors.onAccent : date === t ? colors.accentHi : colors.text, fontSize: 16, fontWeight: selected || date === t ? '700' : '400' }}>{d}</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

function DateView() {
  const date = useOverlay((s) => s.date)
  const close = () => useOverlay.setState({ date: null })
  return (
    <BottomCard visible={!!date} onClose={close}>
      {date && (
        <View style={{ backgroundColor: colors.cardHi, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          {date.title && <Text style={{ color: colors.dim, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>{date.title}</Text>}
          <MonthPicker
            value={date.value}
            onPick={(d) => {
              close()
              date.onPick(d)
            }}
          />
          <Pressable
            onPress={() => {
              close()
              date.onPick(today())
            }}
            style={{ alignSelf: 'center', marginTop: 8, padding: 8 }}
          >
            <Text style={{ color: colors.accentHi, fontWeight: '600' }}>Today</Text>
          </Pressable>
        </View>
      )}
    </BottomCard>
  )
}

function CustomView() {
  const custom = useOverlay((s) => s.custom)
  return (
    <BottomCard visible={!!custom} onClose={closeSheet}>
      {custom}
    </BottomCard>
  )
}

/** Renders whichever pop-up is open. Mounted once at the app's root. */
export function OverlayHost() {
  return (
    <>
      <MenuView />
      <DateView />
      <CustomView />
    </>
  )
}
