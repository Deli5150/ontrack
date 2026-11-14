import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { formatMoney } from '../lib/currency'
import { formatDate, pastPayments, priceOn, today } from '../lib/dates'
import { useDraft } from '../lib/draft'
import { EmptyNote, Group, Header, Page, Pill, Row, SectionLabel } from '../ui/kit'
import { confirm, pickDate } from '../ui/overlays'
import { colors } from '../ui/theme'

export function BillingHistory() {
  const { sub, editingId } = useDraft()
  const full = { ...sub, id: editingId ?? 'draft', createdAt: 0 }
  const paid = pastPayments(full)
  const total = paid.reduce((sum, d) => sum + priceOn(full, d), 0)
  return (
    <Page header={<Header title="Billing History" />}>
      {paid.length ? (
        <>
          <View style={{ alignItems: 'center', marginVertical: 18 }}>
            <Text style={{ color: colors.text, fontSize: 34, fontWeight: '700' }}>{formatMoney(total, sub.currency)}</Text>
            <Text style={{ color: colors.dim, marginTop: 4 }}>
              Paid in total · {paid.length} payment{paid.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Group>
            {paid.slice(0, 500).map((d) => (
              <Row key={d} label={formatDate(d)} value={formatMoney(priceOn(full, d), sub.currency)} />
            ))}
          </Group>
        </>
      ) : (
        <EmptyNote>No payments yet. Past payments show up here, worked out from the payment date and cycle.</EmptyNote>
      )}
    </Page>
  )
}

export function PriceHistory() {
  const { sub, set } = useDraft()
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today())
  const [price, setPrice] = useState('')
  const history = [...sub.priceHistory].sort((a, b) => (a.date < b.date ? 1 : -1))

  const add = () => {
    const n = Number(price.replace(',', '.'))
    if (!(n >= 0)) return
    const next = [...sub.priceHistory.filter((p) => p.date !== date), { date, price: n }].sort((a, b) => (a.date < b.date ? -1 : 1))
    // The newest entry is the current price.
    set({ priceHistory: next, price: next[next.length - 1].price })
    setAdding(false)
    setPrice('')
  }

  const remove = (d: string) => {
    const next = sub.priceHistory.filter((p) => p.date !== d)
    set({ priceHistory: next, ...(next.length ? { price: [...next].sort((a, b) => (a.date < b.date ? -1 : 1))[next.length - 1].price } : {}) })
  }

  return (
    <Page header={<Header title="Price History" right={<Pill label="Add" onPress={() => setAdding(true)} />} />}>
      {adding && (
        <Group>
          <Row
            label="From"
            accessory="none"
            right={
              <Pressable onPress={() => pickDate(date, setDate)} style={{ backgroundColor: colors.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: colors.text }}>{formatDate(date)}</Text>
              </Pressable>
            }
          />
          <Row
            label="Price"
            accessory="none"
            right={
              <TextInput value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={colors.faint} keyboardType="decimal-pad" autoFocus style={{ color: colors.text, fontSize: 16, minWidth: 90, textAlign: 'right' }} />
            }
          />
          <Row label="Save price change" accessory="none" onPress={add} iconColor={colors.accentHi} icon="checkmark" />
        </Group>
      )}
      <SectionLabel>Prices</SectionLabel>
      {history.length ? (
        <Group>
          {history.map((p, i) => (
            <Row
              key={p.date}
              label={formatMoney(p.price, sub.currency)}
              sub={`${i === 0 ? 'Current price' : 'Was'} · from ${formatDate(p.date)}`}
              accessory="none"
              onPress={history.length > 1 ? () => confirm('Remove this price?', `${formatMoney(p.price, sub.currency)} from ${formatDate(p.date)}`, 'Remove', () => remove(p.date)) : undefined}
            />
          ))}
        </Group>
      ) : (
        <EmptyNote>{`The price is ${formatMoney(sub.price, sub.currency)}. When it changes, edit the price and the old one is kept here.`}</EmptyNote>
      )}
    </Page>
  )
}
