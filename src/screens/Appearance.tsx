import { useShallow } from 'zustand/react/shallow'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useStore } from '../lib/store'
import type { WallpaperKind } from '../lib/types'
import { pickWallpaperPhoto, useWallpaperPhoto } from '../lib/wallpaper'
import { Group, Header, Page, Row, SectionLabel, Segmented, Wallpaper } from '../ui/kit'
import { colors, THEMES } from '../ui/theme'

const WALLPAPERS: Array<{ kind: WallpaperKind; label: string }> = [
  { kind: 'glow', label: 'Glow' },
  { kind: 'aurora', label: 'Aurora' },
  { kind: 'horizon', label: 'Horizon' },
  { kind: 'dots', label: 'Dots' },
  { kind: 'plain', label: 'Plain' },
  { kind: 'photo', label: 'Photo' }
]

const DIMS = [
  { label: 'Light', value: '0.3' },
  { label: 'Medium', value: '0.55' },
  { label: 'Strong', value: '0.75' }
]

export function AppearanceScreen() {
  const { settings, setSettings } = useStore(useShallow((s) => ({ settings: s.settings, setSettings: s.setSettings })))
  const photo = useWallpaperPhoto((s) => s.uri)
  const [error, setError] = useState<string | null>(null)

  const choosePhoto = async () => {
    setError(null)
    try {
      if (await pickWallpaperPhoto()) setSettings({ wallpaper: 'photo' })
    } catch (e) {
      setError(`Couldn't use that picture: ${(e as Error).message}`)
    }
  }

  return (
    <Page header={<Header title="Appearance" />}>
      <SectionLabel>Theme</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 20 }}>
        {Object.entries(THEMES).map(([id, t]) => {
          const on = settings.theme === id
          return (
            <Pressable key={id} onPress={() => setSettings({ theme: id })} style={{ width: '25%', padding: 5 }}>
              <View style={{ borderRadius: 16, backgroundColor: t.bg, borderWidth: 2, borderColor: on ? t.accent : colors.border, padding: 12, alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 6, borderColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Ionicons name="checkmark" size={14} color={t.accent} />}
                </View>
                <Text style={{ color: '#fff', fontSize: 13, marginTop: 8, fontWeight: on ? '700' : '500' }}>{t.name}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <SectionLabel>Wallpaper</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 12 }}>
        {WALLPAPERS.map((w) => {
          const on = settings.wallpaper === w.kind
          return (
            <Pressable
              key={w.kind}
              onPress={() => (w.kind === 'photo' && !photo ? void choosePhoto() : setSettings({ wallpaper: w.kind }))}
              style={{ width: '33.33%', padding: 5 }}
            >
              <View style={{ height: 120, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 2, borderColor: on ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                {w.kind === 'photo' && !photo ? <Ionicons name="image-outline" size={26} color={colors.dim} /> : <Wallpaper kind={w.kind} photo={photo} dim={settings.wallpaperDim} />}
              </View>
              <Text style={{ color: on ? colors.text : colors.dim, fontSize: 13, textAlign: 'center', marginTop: 6, fontWeight: on ? '600' : '400' }}>{w.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
      <Group>
        <Row label={photo ? 'Choose another photo' : 'Use a photo'} icon="image-outline" onPress={() => void choosePhoto()} />
      </Group>
      {settings.wallpaper === 'photo' && photo && (
        <>
          <SectionLabel>Darken photo</SectionLabel>
          <Segmented
            value={DIMS.reduce((best, d) => (Math.abs(Number(d.value) - settings.wallpaperDim) < Math.abs(Number(best.value) - settings.wallpaperDim) ? d : best)).value}
            onChange={(v) => setSettings({ wallpaperDim: Number(v) })}
            options={DIMS}
          />
          <Text style={{ color: colors.faint, fontSize: 13, marginTop: 10 }}>The photo stays on this device. Your theme syncs; wallpapers don’t.</Text>
        </>
      )}
    </Page>
  )
}
