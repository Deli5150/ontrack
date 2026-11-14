import { useShallow } from 'zustand/react/shallow'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { CATEGORY_COLORS, newId } from '../lib/defaults'
import { useDraft } from '../lib/draft'
import { useStore } from '../lib/store'
import type { PaymentKind } from '../lib/types'
import { useFlowNav } from '../nav'
import { Group, Header, Page, Row, SectionLabel, type IconName } from '../ui/kit'
import { confirm, showMenu } from '../ui/overlays'
import { colors } from '../ui/theme'

// Settings → Lists, Categories, Payment methods, and choosing a payment method in the edit form.

function NameInput({ initial, onSubmit, placeholder }: { initial?: string; onSubmit: (name: string) => void; placeholder: string }) {
  const [text, setText] = useState(initial ?? '')
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      autoFocus
      onSubmitEditing={() => text.trim() && onSubmit(text.trim())}
      onBlur={() => text.trim() && onSubmit(text.trim())}
      returnKeyType="done"
      style={{ color: colors.text, fontSize: 16, paddingHorizontal: 16, height: 52 }}
    />
  )
}

export function Lists() {
  const { lists, subs, saveList, deleteList } = useStore(useShallow((s) => ({ lists: s.lists, subs: s.subs, saveList: s.saveList, deleteList: s.deleteList })))
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <Page header={<Header title="Lists" right={<Pressable onPress={() => setEditing('new')} hitSlop={10}><Ionicons name="add-circle" size={30} color={colors.accent} /></Pressable>} />}>
      <Text style={{ color: colors.dim, marginBottom: 14 }}>Keep subscriptions apart, like personal and business. Pick the list on the Subscriptions screen.</Text>
      <Group>
        {lists.map((l) =>
          editing === l.id ? (
            <NameInput key={l.id} initial={l.name} placeholder="List name" onSubmit={(name) => (saveList({ ...l, name }), setEditing(null))} />
          ) : (
            <Row
              key={l.id}
              label={l.name}
              value={`${subs.filter((s) => s.listId === l.id).length}`}
              accessory="none"
              onPress={() =>
                showMenu(l.name, [
                  { label: 'Rename', onPress: () => setEditing(l.id) },
                  ...(lists.length > 1
                    ? [{ label: 'Delete', destructive: true, onPress: () => confirm(`Delete ${l.name}?`, `Its subscriptions move to ${lists.find((x) => x.id !== l.id)?.name}.`, 'Delete', () => deleteList(l.id)) }]
                    : [])
                ])
              }
            />
          )
        )}
        {editing === 'new' && <NameInput placeholder="New list" onSubmit={(name) => (saveList({ id: newId(), name }), setEditing(null))} />}
      </Group>
    </Page>
  )
}

export function Categories() {
  const { categories, subs, saveCategory, deleteCategory } = useStore(useShallow((s) => ({ categories: s.categories, subs: s.subs, saveCategory: s.saveCategory, deleteCategory: s.deleteCategory })))
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <Page header={<Header title="Categories" right={<Pressable onPress={() => setEditing('new')} hitSlop={10}><Ionicons name="add-circle" size={30} color={colors.accent} /></Pressable>} />}>
      <Group>
        {editing === 'new' && <NameInput placeholder="New category" onSubmit={(name) => (saveCategory({ id: newId(), name, color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] }), setEditing(null))} />}
        {categories.map((c) =>
          editing === c.id ? (
            <NameInput key={c.id} initial={c.name} placeholder="Category name" onSubmit={(name) => (saveCategory({ ...c, name }), setEditing(null))} />
          ) : (
            <Row
              key={c.id}
              label={c.name}
              left={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color, marginRight: 12 }} />}
              value={`${subs.filter((s) => s.categoryId === c.id).length}`}
              accessory="none"
              onPress={() =>
                showMenu(c.name, [
                  { label: 'Rename', onPress: () => setEditing(c.id) },
                  { label: 'Change color', onPress: () => showMenu('Color', CATEGORY_COLORS.map((color, i) => ({ label: `Color ${i + 1}`, sub: color, selected: color === c.color, onPress: () => saveCategory({ ...c, color }) }))) },
                  ...(c.id !== 'other' ? [{ label: 'Delete', destructive: true, onPress: () => confirm(`Delete ${c.name}?`, 'Its subscriptions move to Other.', 'Delete', () => deleteCategory(c.id)) }] : [])
                ])
              }
            />
          )
        )}
      </Group>
    </Page>
  )
}

export const PAYMENT_KINDS: Array<{ kind: PaymentKind; label: string; icon: IconName }> = [
  { kind: 'card', label: 'Card', icon: 'card' },
  { kind: 'bank', label: 'Bank account', icon: 'business' },
  { kind: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
  { kind: 'apple', label: 'Apple Pay', icon: 'logo-apple' },
  { kind: 'google', label: 'Google Pay', icon: 'logo-google' },
  { kind: 'cash', label: 'Cash', icon: 'cash' },
  { kind: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
  { kind: 'other', label: 'Other', icon: 'wallet' }
]
const kindIcon = (k: PaymentKind): IconName => PAYMENT_KINDS.find((p) => p.kind === k)?.icon ?? 'wallet'

/** Asks for a kind, then the name ("Chase Sapphire ••1234"). */
function useAddMethod(onAdded?: (id: string) => void) {
  const savePaymentMethod = useStore((s) => s.savePaymentMethod)
  const [kind, setKind] = useState<PaymentKind | null>(null)
  const start = () => showMenu('Type', PAYMENT_KINDS.map((p) => ({ label: p.label, onPress: () => setKind(p.kind) })))
  const input = kind ? (
    <NameInput
      placeholder={`Name, e.g. ${kind === 'card' ? 'Chase Visa ••1234' : PAYMENT_KINDS.find((p) => p.kind === kind)?.label}`}
      onSubmit={(name) => {
        const id = newId()
        savePaymentMethod({ id, name, kind })
        setKind(null)
        onAdded?.(id)
      }}
    />
  ) : null
  return { start, input }
}

export function PaymentMethods() {
  const { paymentMethods, subs, deletePaymentMethod } = useStore(useShallow((s) => ({ paymentMethods: s.paymentMethods, subs: s.subs, deletePaymentMethod: s.deletePaymentMethod })))
  const add = useAddMethod()
  return (
    <Page header={<Header title="Payment methods" right={<Pressable onPress={add.start} hitSlop={10}><Ionicons name="add-circle" size={30} color={colors.accent} /></Pressable>} />}>
      {paymentMethods.length === 0 && !add.input && <Text style={{ color: colors.dim, marginBottom: 14 }}>Add the cards and accounts you pay with to see what each one is charged.</Text>}
      {(paymentMethods.length > 0 || add.input) && (
        <Group>
          {paymentMethods.map((p) => (
            <Row
              key={p.id}
              label={p.name}
              icon={kindIcon(p.kind)}
              value={`${subs.filter((s) => s.paymentMethodId === p.id && !s.cancelledAt).length}`}
              accessory="none"
              onPress={() => confirm(`Delete ${p.name}?`, 'Subscriptions paid with it are set to None.', 'Delete', () => deletePaymentMethod(p.id))}
            />
          ))}
          {add.input}
        </Group>
      )}
    </Page>
  )
}

export function PaymentPick() {
  const nav = useFlowNav()
  const { paymentMethods } = useStore(useShallow((s) => ({ paymentMethods: s.paymentMethods })))
  const { sub, set } = useDraft(useShallow((s) => ({ sub: s.sub, set: s.set })))
  const pick = (id: string | null) => {
    set({ paymentMethodId: id })
    nav.goBack()
  }
  const add = useAddMethod((id) => pick(id))
  return (
    <Page header={<Header title="Payment Method" />}>
      <Group>
        <Row label="None" accessory="none" onPress={() => pick(null)} right={sub.paymentMethodId === null ? <Ionicons name="checkmark" size={20} color={colors.accentHi} /> : undefined} />
        {paymentMethods.map((p) => (
          <Row key={p.id} label={p.name} icon={kindIcon(p.kind)} accessory="none" onPress={() => pick(p.id)} right={sub.paymentMethodId === p.id ? <Ionicons name="checkmark" size={20} color={colors.accentHi} /> : undefined} />
        ))}
      </Group>
      <SectionLabel>New</SectionLabel>
      <Group>{add.input ?? <Row label="Add payment method" icon="add" iconColor={colors.accentHi} onPress={add.start} />}</Group>
    </Page>
  )
}
