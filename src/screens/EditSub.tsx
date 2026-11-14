import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { CURRENCIES, currencyOf, formatMoney } from '../lib/currency'
import { cycleLabel, formatDate, pastPayments, today } from '../lib/dates'
import { commitDraft, useDraft } from '../lib/draft'
import { useStore } from '../lib/store'
import type { Cycle, CycleUnit, Duration } from '../lib/types'
import { useFlowNav } from '../nav'
import { Field, Group, Header, Page, Pill, Row, SectionLabel, Toggle } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { closeSheet, confirm, pickDate, showMenu, showSheet } from '../ui/overlays'
import { colors } from '../ui/theme'

export const NOTIFY_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'None', value: null },
  { label: 'Same day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '2 days before', value: 2 },
  { label: '3 days before', value: 3 },
  { label: '1 week before', value: 7 },
  { label: '2 weeks before', value: 14 }
]

export const notifyLabel = (v: number | null): string => NOTIFY_OPTIONS.find((o) => o.value === v)?.label ?? `${v} days before`

const UNITS: CycleUnit[] = ['day', 'week', 'month', 'year']

/** Picks "every N units": a stepper and the four units. */
function CycleSheet({ value, onDone }: { value: Cycle; onDone: (c: Cycle) => void }) {
  const [c, setC] = useState(value)
  return (
    <View style={{ backgroundColor: colors.cardHi, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.dim, fontWeight: '600', marginBottom: 14 }}>Billing cycle</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setC({ ...c, every: Math.max(1, c.every - 1) })} style={stepBtn}>
          <Ionicons name="remove" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', width: 150, textAlign: 'center' }}>{cycleLabel(c)}</Text>
        <Pressable onPress={() => setC({ ...c, every: Math.min(99, c.every + 1) })} style={stepBtn}>
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {UNITS.map((u) => (
          <Pressable key={u} onPress={() => setC({ ...c, unit: u })} style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.unit === u ? colors.accent : colors.field }}>
            <Text style={{ color: colors.text, fontWeight: '600', textTransform: 'capitalize' }}>{u}s</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => onDone(c)} style={{ marginTop: 16, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16 }}>Done</Text>
      </Pressable>
    </View>
  )
}

const stepBtn = { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' } as const

/** Picks a number of payments. */
function CountSheet({ value, onDone }: { value: number; onDone: (n: number) => void }) {
  const [n, setN] = useState(value)
  return (
    <View style={{ backgroundColor: colors.cardHi, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.dim, fontWeight: '600', marginBottom: 14 }}>Number of payments</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={() => setN(Math.max(1, n - 1))} style={stepBtn}>
          <Ionicons name="remove" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', width: 120, textAlign: 'center' }}>{n}</Text>
        <Pressable onPress={() => setN(Math.min(999, n + 1))} style={stepBtn}>
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Pressable onPress={() => onDone(n)} style={{ marginTop: 18, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16 }}>Done</Text>
      </Pressable>
    </View>
  )
}

function durationLabel(d: Duration): string {
  if (d.kind === 'forever') return 'Forever'
  if (d.kind === 'payments') return `${d.count} payment${d.count === 1 ? '' : 's'}`
  return `Until ${formatDate(d.date)}`
}

export default function EditSub() {
  const nav = useFlowNav()
  const { sub, editingId, set } = useDraft()
  const { lists, categories, paymentMethods, deleteSub, updateSub } = useStore()
  const [priceText, setPriceText] = useState(sub.price ? String(sub.price) : '')
  const canSave = sub.name.trim().length > 0

  const close = () => nav.getParent()?.goBack()
  // Opened from an import's list: back to that list after saving.
  const fromReview = nav.getState().routes.some((r) => r.name === 'Review')
  const save = () => {
    commitDraft()
    if (fromReview) nav.goBack()
    else close()
  }

  const pickCurrency = () =>
    showMenu(
      'Currency',
      CURRENCIES.map((c) => ({ label: `${c.code}  ${c.symbol}`, sub: c.name, selected: c.code === sub.currency, onPress: () => set({ currency: c.code }) }))
    )

  const pickDuration = () =>
    showMenu('Duration', [
      { label: 'Forever', selected: sub.duration.kind === 'forever', onPress: () => set({ duration: { kind: 'forever' } }) },
      {
        label: 'Number of payments',
        selected: sub.duration.kind === 'payments',
        onPress: () =>
          showSheet(
            <CountSheet
              value={sub.duration.kind === 'payments' ? sub.duration.count : 12}
              onDone={(count) => {
                closeSheet()
                set({ duration: { kind: 'payments', count } })
              }}
            />
          )
      },
      {
        label: 'Until a date',
        selected: sub.duration.kind === 'until',
        onPress: () => pickDate(sub.duration.kind === 'until' ? sub.duration.date : sub.startDate, (date) => set({ duration: { kind: 'until', date } }), 'Last payment on or before')
      }
    ])

  const category = categories.find((c) => c.id === sub.categoryId)
  const method = paymentMethods.find((p) => p.id === sub.paymentMethodId)
  const paid = editingId ? pastPayments({ ...sub, id: editingId, createdAt: 0 }).length : 0

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page header={<Header title={editingId ? 'Edit Subscription' : 'Add Subscription'} left={editingId ? 'close' : 'back'} onLeft={editingId ? close : undefined} right={<Pill label="Save" onPress={save} disabled={!canSave} />} />}>
        <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Pressable onPress={() => nav.navigate('Logo')} accessibilityLabel="Choose logo">
            {sub.logo ? (
              <Logo logo={sub.logo} name={sub.name} color={sub.color} size={60} />
            ) : (
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={30} color={colors.text} />
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TextInput
              value={sub.name}
              onChangeText={(name) => set({ name })}
              placeholder="Name"
              placeholderTextColor={colors.faint}
              style={{ color: colors.text, fontSize: 18, fontWeight: '600', paddingVertical: 4, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Pressable onPress={pickCurrency} style={{ minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 7, backgroundColor: colors.accentDeep, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{currencyOf(sub.currency).symbol}</Text>
              </Pressable>
              <TextInput
                value={priceText}
                onChangeText={(t) => {
                  const clean = t.replace(/[^\d.,]/g, '').replace(',', '.')
                  setPriceText(clean)
                  set({ price: Number(clean) || 0 })
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.faint}
                style={{ color: colors.text, fontSize: 17, flex: 1, paddingVertical: 4, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) }}
              />
            </View>
          </View>
        </View>

        <Group>
          <Row
            label={sub.freeTrial ? 'Trial ends' : sub.type === 'once' ? 'Payment date' : editingId ? 'First payment' : 'Payment date'}
            accessory="none"
            right={
              <Pressable onPress={() => pickDate(sub.startDate, (startDate) => set({ startDate }))} style={{ backgroundColor: colors.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{formatDate(sub.startDate)}</Text>
              </Pressable>
            }
          />
          <Row
            label="Type"
            value={sub.type === 'recurring' ? 'Recurring' : 'One-time'}
            accessory="updown"
            onPress={() =>
              showMenu('Type', [
                { label: 'Recurring', selected: sub.type === 'recurring', onPress: () => set({ type: 'recurring' }) },
                { label: 'One-time', selected: sub.type === 'once', onPress: () => set({ type: 'once' }) }
              ])
            }
          />
          {sub.type === 'recurring' && (
            <Row
              label="Cycle"
              value={cycleLabel(sub.cycle)}
              accessory="none"
              onPress={() =>
                showSheet(
                  <CycleSheet
                    value={sub.cycle}
                    onDone={(cycle) => {
                      closeSheet()
                      set({ cycle })
                    }}
                  />
                )
              }
            />
          )}
          {sub.type === 'recurring' && <Row label="Duration" value={durationLabel(sub.duration)} accessory="updown" onPress={pickDuration} />}
          <Row label="Free Trial" accessory="none" right={<Toggle value={sub.freeTrial} onChange={(freeTrial) => set({ freeTrial })} />} />
        </Group>

        <Group>
          <Row
            label="List"
            value={lists.find((l) => l.id === sub.listId)?.name ?? '—'}
            accessory="updown"
            onPress={() => showMenu('List', lists.map((l) => ({ label: l.name, selected: l.id === sub.listId, onPress: () => set({ listId: l.id }) })))}
          />
          <Row
            label="Category"
            value={category?.name ?? 'Other'}
            accessory="updown"
            onPress={() => showMenu('Category', categories.map((c) => ({ label: c.name, selected: c.id === sub.categoryId, onPress: () => set({ categoryId: c.id }) })))}
          />
          <Row label="Payment Method" value={method?.name ?? 'None'} onPress={() => nav.navigate('PaymentPick')} />
        </Group>

        <Group>
          <Row
            label="Notification"
            value={notifyLabel(sub.notify)}
            accessory="updown"
            onPress={() => showMenu('Remind me', NOTIFY_OPTIONS.map((o) => ({ label: o.label, selected: o.value === sub.notify, onPress: () => set({ notify: o.value }) })))}
          />
        </Group>

        <Group>
          <Row label="Billing History" value={editingId && paid ? `${paid} paid` : undefined} onPress={() => nav.navigate('BillingHistory')} />
          <Row label="Price History" value={sub.priceHistory.length > 1 ? `${sub.priceHistory.length} prices` : undefined} onPress={() => nav.navigate('PriceHistory')} />
        </Group>

        <SectionLabel>URL</SectionLabel>
        <Field value={sub.url} onChangeText={(url) => set({ url })} placeholder="E.g. OnTrack.app" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ marginBottom: 18 }} />
        <SectionLabel>Notes</SectionLabel>
        <Field value={sub.notes} onChangeText={(notes) => set({ notes })} multiline style={{ marginBottom: 24 }} />

        {editingId && (
          <Group>
            {sub.cancelledAt ? (
              <Row
                label="Resume subscription"
                icon="refresh"
                iconColor={colors.success}
                accessory="none"
                onPress={() => {
                  updateSub(editingId, { cancelledAt: null })
                  close()
                }}
              />
            ) : (
              <Row
                label="Mark as cancelled"
                sub={sub.price ? `Saves about ${formatMoney(sub.price, sub.currency)} each payment` : undefined}
                icon="close-circle-outline"
                iconColor={colors.danger}
                accessory="none"
                onPress={() =>
                  pickDate(
                    today(),
                    (cancelledAt) => {
                      commitDraft()
                      updateSub(editingId, { cancelledAt })
                      close()
                    },
                    'Cancelled on'
                  )
                }
              />
            )}
            <Row
              label="Delete subscription"
              icon="trash-outline"
              iconColor={colors.danger}
              danger
              accessory="none"
              onPress={() =>
                confirm(`Delete ${sub.name || 'this subscription'}?`, 'Its billing history goes with it.', 'Delete', () => {
                  deleteSub(editingId)
                  close()
                })
              }
            />
          </Group>
        )}
      </Page>
    </KeyboardAvoidingView>
  )
}
