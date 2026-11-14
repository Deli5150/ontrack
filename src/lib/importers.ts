import * as DocumentPicker from 'expo-document-picker'
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'
import { chargesFromCsv, findRecurring, parseDocumentText, type Draft } from './parse'
import { desktop } from './storage'

// Finding subscriptions in a photo (receipt, renewal email, App Store screenshot) or a file (bank
// statement CSV or PDF). Text is read on the device: Apple Vision / ML Kit on phones, Tesseract
// in the desktop app.

export class ImportError extends Error {}

async function ocrNative(uri: string): Promise<string> {
  const { extractTextFromImage, isSupported } = await import('expo-text-extractor')
  if (!isSupported) throw new ImportError("This device can't read text from photos.")
  return (await extractTextFromImage(uri)).join('\n')
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

/** Picks a CSV or PDF statement and finds the recurring charges in it. Null when cancelled. */
export async function importFromFile(currency: string): Promise<Draft[] | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/pdf', 'text/plain', 'application/vnd.ms-excel', '*/*'],
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
  const text = asset.file ? await asset.file.text() : await readAsStringAsync(asset.uri)
  const charges = chargesFromCsv(text)
  return dedupe(charges.length ? findRecurring(charges, currency) : parseDocumentText(text, currency))
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
