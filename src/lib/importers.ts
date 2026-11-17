import * as DocumentPicker from 'expo-document-picker'
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'
import OntrackOcr from '../../modules/ontrack-ocr/src/OntrackOcrModule'
import { csvRows, parseDocumentText, parseSheet, textInRows, type Draft } from './parse'
import { desktop } from './storage'

// Finding subscriptions in a photo (receipt, renewal email, App Store screenshot) or a file (bank
// statement CSV or PDF). Text is read on the device: Apple Vision / ML Kit on phones, Tesseract
// in the desktop app.

export class ImportError extends Error {}

async function ocrNative(uri: string): Promise<string> {
  if (!OntrackOcr) throw new ImportError("This device can't read text from photos.")
  return textInRows(await OntrackOcr.recognize(uri))
}

/** Picks screenshots or photos and reads the subscriptions in them. Null when cancelled. */
export async function importFromPhotos(currency: string): Promise<Draft[] | null> {
  const native = Platform.OS !== 'web'
  if (!native && !desktop) throw new ImportError('Reading photos works in the OnTrack app.')
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, base64: !native })
  if (res.canceled) return null
  const drafts: Draft[] = []
  for (const asset of res.assets) {
    const text = native ? await ocrNative(asset.uri) : await desktop!.ocr(asset.base64 ? `data:${asset.mimeType ?? 'image/png'};base64,${asset.base64}` : asset.uri)
    drafts.push(...parseDocumentText(text, currency))
  }
  return dedupe(drafts)
}

/**
 * Picks a file: a spreadsheet (CSV or Excel) listing subscriptions, or a bank statement (CSV, Excel
 * or PDF) whose recurring charges are subscriptions. Null when cancelled.
 */
export async function importFromFile(currency: string): Promise<Draft[] | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/pdf', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
    copyToCacheDirectory: true,
    base64: false
  })
  if (res.canceled) return null
  const asset = res.assets[0]
  const isPdf = /\.pdf$/i.test(asset.name) || asset.mimeType === 'application/pdf'
  if (isPdf) {
    let text: string
    if (desktop) {
      const base64 = asset.file ? await blobToBase64(asset.file) : await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 })
      text = await desktop.pdfText(base64)
    } else {
      throw new ImportError('PDF statements are read by the desktop app. On a phone, download your statement as a CSV (most banks offer it), or take a screenshot and use Import from photos.')
    }
    return dedupe(parseDocumentText(text, currency))
  }
  if (/\.xlsx$/i.test(asset.name) || asset.mimeType?.includes('spreadsheetml')) {
    const base64 = asset.file ? await blobToBase64(asset.file) : await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 })
    const { rowsFromXlsx } = await import('./xlsx')
    let rows: string[][]
    try {
      rows = rowsFromXlsx(base64ToBytes(base64))
    } catch {
      throw new ImportError("Couldn't open this spreadsheet. Try saving it as CSV and importing that.")
    }
    return dedupe(parseSheet(rows, currency))
  }
  if (/\.(xls|numbers|ods)$/i.test(asset.name)) {
    throw new ImportError('OnTrack reads CSV and Excel (.xlsx) files. Save or export the spreadsheet as one of those and import it again.')
  }
  const text = asset.file ? await asset.file.text() : await readAsStringAsync(asset.uri)
  const rows = csvRows(text)
  // A real table has several columns; anything else is plain text (a pasted receipt or list).
  const tabular = rows.length >= 2 && rows.filter((r) => r.length >= 2).length >= rows.length * 0.6
  return dedupe(tabular ? parseSheet(rows, currency) : parseDocumentText(text, currency))
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function dedupe(drafts: Draft[]): Draft[] {
  const seen = new Set<string>()
  return drafts.filter((d) => {
    const k = `${d.name.toLowerCase()}|${d.price}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
