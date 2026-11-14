import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UpdateStatus } from './release'

// Where OnTrack keeps its data: on desktop, a JSON file in the app's data folder (through the
// Electron preload's bridge); on phones (and a plain browser), AsyncStorage.

const KEY = 'ontrack:data'

export interface DesktopBridge {
  platform: 'darwin' | 'win32' | 'linux'
  version: string
  load(): Promise<string | null>
  save(json: string): Promise<void>
  setReminders(reminders: Array<{ id: string; at: number; title: string; body: string }>): void
  notifyNow(title: string, body: string): void
  saveFile(name: string, content: string): Promise<boolean>
  ocr(dataUrl: string): Promise<string>
  pdfText(base64: string): Promise<string>
  openExternal(url: string): void
  google: {
    configured: boolean
    signIn(): Promise<string | undefined>
    signOut(): Promise<void>
    fetch(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; text: string }>
  }
  updater: {
    status(): Promise<UpdateStatus>
    check(quiet?: boolean): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
    setAuto(enabled: boolean): void
    onChange(cb: (status: UpdateStatus) => void): () => void
  }
}

export const desktop: DesktopBridge | null =
  typeof window !== 'undefined' ? ((window as unknown as { ontrack?: DesktopBridge }).ontrack ?? null) : null

export async function loadData(): Promise<string | null> {
  if (desktop) return desktop.load()
  return AsyncStorage.getItem(KEY)
}

export async function saveData(json: string): Promise<void> {
  if (desktop) return desktop.save(json)
  await AsyncStorage.setItem(KEY, json)
}
