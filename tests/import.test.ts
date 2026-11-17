import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { csvRows, parseDocumentText, parseSheet, textInRows } from '../src/lib/parse'
import { rowsFromXlsx } from '../src/lib/xlsx'

import type { OcrLine } from '../modules/ontrack-ocr/src/OntrackOcrModule'

const brief = (d: ReturnType<typeof parseSheet>) => d.map((x) => [x.name, x.price, `${x.cycle.every}${x.cycle.unit[0]}`, x.categoryId])

test('#1 a screenshot of another app’s subscription list finds every row', () => {
  // Names on the left, prices and dates on the right: Vision returns them as separate lines, often a column at a time.
  const L = (text: string, x: number, y: number): OcrLine => ({ text, x, y, w: 0.3, h: 0.02 })
  const lines = [
    L('9:41', 0.05, 0.01),
    L('Subscriptions', 0.05, 0.08),
    L('Netflix', 0.2, 0.2),
    L('Spotify', 0.2, 0.3),
    L('iCloud+', 0.2, 0.4),
    L('Gym membership', 0.2, 0.5),
    L('$15.49', 0.75, 0.201),
    L('$11.99', 0.75, 0.302),
    L('$2.99', 0.75, 0.399),
    L('$40.00', 0.75, 0.5),
    L('Monthly · Dec 3', 0.2, 0.23),
    L('Monthly · Dec 12', 0.2, 0.33),
    L('Monthly · Nov 30', 0.2, 0.43),
    L('Every 2 weeks', 0.2, 0.53),
    L('Total per month', 0.05, 0.7),
    L('$150.45', 0.75, 0.7)
  ]
  const found = parseDocumentText(textInRows(lines), 'USD')
  assert.deepEqual(
    found.map((d) => [d.name, d.price, d.cycle.every, d.cycle.unit]),
    [['Netflix', 15.49, 1, 'month'], ['Spotify', 11.99, 1, 'month'], ['iCloud+', 2.99, 1, 'month'], ['Gym Membership', 40, 2, 'week']]
  )
  assert.match(found[0].date ?? '', /-12-03$/)
})

test('#1 the App Store’s subscriptions page (names and renewal dates, no prices)', () => {
  const text = 'Subscriptions\nActive\nApple Music\nIndividual (Monthly)\nRenews December 3\nYouTube Premium\nRenews November 28\nDisney+\nMonthly\nRenews December 14'
  assert.deepEqual(parseDocumentText(text, 'USD').map((d) => d.name), ['Apple Music', 'YouTube Premium', 'Disney+'])
})

test('#1 one line per subscription (desktop OCR keeps rows)', () => {
  const text = 'My subscriptions\nNetflix   $15.49 / mo\nHulu   $7.99 / mo\nAdobe Creative Cloud   $659.88 / yr\nTotal  $78.43 / mo'
  assert.deepEqual(parseDocumentText(text, 'USD').map((d) => [d.name, d.price, d.cycle.unit]), [['Netflix', 15.49, 'month'], ['Hulu', 7.99, 'month'], ['Adobe Creative Cloud', 659.88, 'year']])
})

test('a receipt is still one subscription', () => {
  const [d, more] = parseDocumentText('Your Disney+ subscription\nMonthly plan\nTotal: $11.99\nRenews on Dec 4, 2026', 'USD')
  assert.equal(more, undefined)
  assert.equal(d.name, 'Disney+')
  assert.equal(d.price, 11.99)
})

test('#2 a spreadsheet of subscriptions and debts imports one per row', () => {
  const csv = 'Name,Amount,Frequency,Due Date,Category\nNetflix,$15.49,Monthly,3,Streaming\nCar Loan,$412.00,Monthly,15,\nChase Sapphire,$85.00,Monthly,22nd,Debt\nStudent loan,$230.50,monthly,1,\nAmazon Prime,$139.00,Yearly,2027-03-01,\nTotal,$881.99,,,'
  const found = parseSheet(csvRows(csv), 'USD')
  assert.deepEqual(brief(found), [
    ['Netflix', 15.49, '1m', 'streaming'],
    ['Car Loan', 412, '1m', 'finance'],
    ['Chase Sapphire', 85, '1m', 'finance'],
    ['Student loan', 230.5, '1m', 'finance'],
    ['Amazon Prime', 139, '1y', 'shopping']
  ])
  assert.ok(found.every((d) => d.date && d.date >= new Date().toISOString().slice(0, 8) + '01'))
})

test('#2 a debt sheet uses the payment, not the balance or rate', () => {
  const csv = 'Debt,Balance,APR,Minimum Payment,Due\nDiscover card,"$3,200.00",24.99%,$96.00,8\nMortgage,"$212,000.00",6.1%,"$1,650.00",1'
  assert.deepEqual(brief(parseSheet(csvRows(csv), 'USD')), [['Discover card', 96, '1m', 'finance'], ['Mortgage', 1650, '1m', 'housing']])
})

test('#2 a sheet with no header row', () => {
  const csv = 'Netflix,15.49\nSpotify,11.99\nPhone bill,65.00'
  assert.deepEqual(parseSheet(csvRows(csv), 'USD').map((d) => [d.name, d.price]), [['Netflix', 15.49], ['Spotify', 11.99], ['Phone bill', 65]])
})

test('a bank statement still finds the repeated charges', () => {
  const csv = 'Date,Description,Amount\n2026-08-03,NETFLIX.COM 866,-15.99\n2026-09-03,NETFLIX.COM 866,-15.99\n2026-10-03,NETFLIX.COM 866,-17.99\n2026-10-05,STARBUCKS #1,-5.40\n2026-10-21,Payroll,2000.00'
  assert.deepEqual(parseSheet(csvRows(csv), 'USD').map((d) => [d.name, d.price]), [['Netflix', 17.99]])
})

test('#2 Excel workbooks (.xlsx), with dates stored as day numbers', () => {
  const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8"?>${s}`)
  const zip = zipSync({
    'xl/workbook.xml': xml('<workbook xmlns:r="r"><sheets><sheet name="Bills" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': xml('<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': xml('<sst><si><t>Subscription</t></si><si><t>Price</t></si><si><t>Next payment</t></si><si><r><t>Spot</t></r><r><t>ify</t></r></si><si><t>Rent &amp; utilities</t></si></sst>'),
    'xl/styles.xml': xml('<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': xml(
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>11.99</v></c><c r="C2" s="1"><v>46387</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3"><v>1800</v></c></row></sheetData></worksheet>'
    )
  })
  const rows = rowsFromXlsx(zip)
  assert.deepEqual(rows[1], ['Spotify', '11.99', '2026-12-31'])
  assert.deepEqual(brief(parseSheet(rows, 'USD')), [['Spotify', 11.99, '1m', 'music'], ['Rent & utilities', 1800, '1m', 'housing']])
})

test('an App Store receipt is one subscription at its plan price, not the tax or the date', () => {
  const text = 'Receipt\nApple Account: someone@icloud.com\nBilled To\nVisa .... 1234\nOrder ID\nMLXJ2K9P\nYouTube Premium\nIndividual (Monthly)\nRenews Dec 3, 2026\n$13.99\nSubtotal $13.99\nTax $1.12\nTotal $15.11'
  assert.deepEqual(parseDocumentText(text, 'USD').map((d) => [d.name, d.price, d.date]), [['YouTube Premium', 13.99, '2026-12-03']])
})

test('OnTrack’s own spreadsheet export imports back', () => {
  const csv = 'Name,Price,Currency,Cycle,Next payment,First payment,List,Category,Status,URL,Notes\nNetflix,15.49,USD,Monthly,2026-12-03,2024-01-03,Personal,Streaming,Active,,\nGym,40,EUR,Every 2 weeks,2026-11-20,2025-06-01,,Health & Fitness,Active,,"Notes, with a comma"\nHulu,7.99,USD,Monthly,,2023-01-01,,Streaming,Cancelled 2026-01-01,,'
  assert.deepEqual(
    parseSheet(csvRows(csv), 'USD').map((d) => [d.name, d.price, d.currency, `${d.cycle.every}${d.cycle.unit[0]}`, d.date, d.categoryId]),
    [['Netflix', 15.49, 'USD', '1m', '2026-12-03', 'streaming'], ['Gym', 40, 'EUR', '2w', '2026-11-20', 'health']]
  )
})
