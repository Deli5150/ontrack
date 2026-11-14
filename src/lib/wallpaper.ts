import AsyncStorage from '@react-native-async-storage/async-storage'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { create } from 'zustand'

// Your own wallpaper photo: picked, shrunk to a phone-screen size and kept on this device only
// (its own storage entry, apart from the data document, which stays small and is what syncs).

const KEY = 'ontrack:wallpaper'

export const useWallpaperPhoto = create<{ uri: string | null }>(() => ({ uri: null }))

export async function loadWallpaperPhoto(): Promise<void> {
  try {
    useWallpaperPhoto.setState({ uri: await AsyncStorage.getItem(KEY) })
  } catch {}
}

/** Asks for a photo; true when one was chosen and saved. */
export async function pickWallpaperPhoto(): Promise<boolean> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  if (res.canceled) return false
  const asset = res.assets[0]
  const tall = (asset.height ?? 1) >= (asset.width ?? 1)
  const ref = await ImageManipulator.manipulate(asset.uri)
    .resize(tall ? { width: 1080 } : { height: 1080 })
    .renderAsync()
  const out = await ref.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.72 })
  const uri = `data:image/jpeg;base64,${out.base64}`
  await AsyncStorage.setItem(KEY, uri)
  useWallpaperPhoto.setState({ uri })
  return true
}
