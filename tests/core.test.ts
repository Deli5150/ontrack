import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyData } from '../src/lib/defaults'
import { monthlyCost, nextPayment, paymentsBetween } from '../src/lib/dates'
import { chargesFromCsv, findRecurring, parseDocumentText, parseTyped } from '../src/lib/parse'
import { emptyDoc, emptyMeta, merge, stampChanges } from '../src/lib/sync'
import type { Subscription } from '../src/lib/types'

const sub = (patch: Partial<Subscription>): Subscription =>
  ({ id: 'x', name: 'X', startDate: '2026-01-31', cycle: { every: 1, unit: 'month' }, type: 'recurring', duration: { kind: 'forever' }, cancelledAt: null, freeTrial: false, price: 10, priceHistory: [], ...patch }) as Subscription

test('monthly payments keep the day, or the month’s last day', () => {
  assert.deepEqual(paymentsBetween(sub({}), '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
})

test('cancelled and limited subscriptions stop', () => {
  assert.equal(nextPayment(sub({ cancelledAt: '2026-03-01' }), '2026-04-01'), null)
  assert.equal(nextPayment(sub({ duration: { kind: 'payments', count: 2 } }), '2026-03-01'), null)
})

test('monthly cost of a yearly plan', () => {
  assert.equal(monthlyCost({ price: 120, cycle: { every: 1, unit: 'year' }, type: 'recurring' }), 10)
})

test('typed subscriptions', () => {
  const d = parseTyped('Netflix 15.99 monthly\nAdobe 599.88 yearly\ngym 40 every 2 weeks', 'USD')
  assert.deepEqual(d.map((x) => [x.name, x.price, x.cycle.unit, x.cycle.every]), [['Netflix', 15.99, 'month', 1], ['Adobe Creative Cloud', 599.88, 'year', 1], ['Gym', 40, 'week', 2]])
})

test('recurring charges in a statement', () => {
  const csv = 'Date,Description,Amount\n2026-08-03,NETFLIX.COM 866,-15.99\n2026-09-03,NETFLIX.COM 866,-15.99\n2026-10-03,NETFLIX.COM 866,-17.99\n2026-10-05,STARBUCKS #1,-5.40\n2026-10-21,Payroll,2000.00'
  const found = findRecurring(chargesFromCsv(csv), 'USD')
  assert.deepEqual(found.map((f) => [f.name, f.price]), [['Netflix', 17.99]])
})

test('a receipt screenshot', () => {
  const [d] = parseDocumentText('Your Disney+ subscription\nMonthly plan\nTotal: $11.99\nRenews on Dec 4, 2026', 'USD')
  assert.equal(d.name, 'Disney+')
  assert.equal(d.price, 11.99)
  assert.equal(d.date, '2026-12-04')
})

test('sync: a new device gets everything; a later delete beats an earlier edit', () => {
  let A = { ...emptyData(), subs: [] as Subscription[] }
  let mA = emptyMeta()
  const A2 = { ...A, subs: [sub({ id: 'n', name: 'Netflix' })] }
  mA = stampChanges(A, A2, mA, 1000)!
  A = A2
  let r = merge(A, mA, emptyDoc(), 1100)
  let cloud = r.doc
  mA = r.meta
  let B = { ...emptyData(), subs: [] as Subscription[] }
  r = merge(B, emptyMeta(), cloud, 1200)
  B = r.data as typeof B
  let mB = r.meta
  assert.deepEqual(B.subs.map((s) => s.name), ['Netflix'])
  const B2 = { ...B, subs: [sub({ id: 'n', name: 'Netflix 4K' })] }
  mB = stampChanges(B, B2, mB, 1300)!
  B = B2
  const A3 = { ...A, subs: [] }
  mA = stampChanges(A, A3, mA, 1400)!
  A = A3
  r = merge(B, mB, cloud, 1500)
  cloud = r.doc
  mB = r.meta
  B = r.data as typeof B
  r = merge(A, mA, cloud, 1600)
  cloud = r.doc
  r = merge(B, mB, cloud, 1700)
  assert.equal(r.data.subs.length, 0)
})
