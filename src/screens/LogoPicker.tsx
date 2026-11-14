import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import { FlatList, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { ALL_SERVICES } from '../data/catalog'
import { EMOJI, ICONS, LOGO_COLORS } from '../data/icons'
import { useDraft } from '../lib/draft'
import type { Logo as LogoT } from '../lib/types'
import { useFlowNav } from '../nav'
import { Backdrop, Column, Header, Pill, SearchField, Segmented } from '../ui/kit'
import { Logo, onColor } from '../ui/Logo'
import { colors } from '../ui/theme'

type Tab = 'search' | 'icon' | 'emoji' | 'upload'

/** Websites a typed brand might live at. */
function guesses(q: string): string[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))) return [t.replace(/^https?:\/\//, '').replace(/\/.*$/, '')]
  const slug = t.replace(/[^a-z0-9]+/g, '')
  return slug ? [`${slug}.com`, `${slug}.io`, `${slug}.app`, `${slug}.co`] : []
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
      {LOGO_COLORS.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: value === c ? 3 : 1, borderColor: value === c ? colors.accentHi : 'rgba(255,255,255,0.25)' }} />
      ))}
    </ScrollView>
  )
}

export default function LogoPicker() {
  const nav = useFlowNav()
  const { sub, set } = useDraft()
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState(sub.logo?.kind === 'domain' ? '' : sub.name)
  const [bg, setBg] = useState(sub.logo?.kind === 'icon' || sub.logo?.kind === 'emoji' ? sub.logo.color : '#3b3650')

  const choose = (logo: LogoT | null, color?: string) => {
    set({ logo, ...(color ? { color } : {}) })
    nav.goBack()
  }

  const q = query.trim().toLowerCase()
  const brands = useMemo(() => (q ? ALL_SERVICES.filter((s) => s.name.toLowerCase().includes(q) || s.domain.includes(q)).slice(0, 8) : []), [q])
  const icons = useMemo(() => (q ? ICONS.filter(([n, k]) => n.includes(q) || k.includes(q)) : ICONS), [q])
  const emoji = useMemo(() => (q ? EMOJI.filter(([, k]) => k.includes(q)) : EMOJI), [q])

  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: Platform.OS !== 'web', aspect: [1, 1], quality: 1 })
    if (res.canceled) return
    const ref = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 256, height: 256 }).renderAsync()
    const out = await ref.saveAsync({ base64: true, format: SaveFormat.PNG })
    choose({ kind: 'image', uri: `data:image/png;base64,${out.base64}` }, '#ffffff')
  }

  const COLS = 5
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop stars={false} />
      <View style={{ paddingTop: Platform.OS === 'ios' ? 8 : 0 }}>
        <Header title="Add Logo" left="cancel" right={sub.logo ? <Pill label="Remove" onPress={() => choose(null)} /> : undefined} />
      </View>
      <Column style={{ flex: 1 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Search', value: 'search' },
            { label: 'Icon', value: 'icon' },
            { label: 'Emoji', value: 'emoji' },
            { label: 'Upload', value: 'upload' }
          ]}
        />
        {tab !== 'upload' && (
          <SearchField value={query} onChange={setQuery} placeholder={tab === 'search' ? 'Search for a logo' : tab === 'icon' ? 'Search for an Icon' : 'Search for an Emoji'} style={{ marginVertical: 14 }} />
        )}
        {tab === 'search' && (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.dim, fontSize: 15, marginBottom: 8 }}>Enter a brand or website</Text>
            {[...brands.map((b) => ({ domain: b.domain, label: b.name, color: b.color })), ...guesses(query).filter((d) => !brands.some((b) => b.domain === d)).map((d) => ({ domain: d, label: d, color: '#ffffff' }))].map((r) => (
              <Pressable key={r.label + r.domain} onPress={() => choose({ kind: 'domain', domain: r.domain }, r.color)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}>
                <Logo logo={{ kind: 'domain', domain: r.domain }} name={r.label} color={r.color} size={36} />
                <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12 }}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {tab === 'icon' && (
          <>
            <Swatches value={bg} onChange={setBg} />
            <FlatList
              data={icons}
              numColumns={COLS}
              keyExtractor={([n]) => n}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: [name] }) => (
                <Pressable onPress={() => choose({ kind: 'icon', name, color: bg }, bg)} style={{ flex: 1 / COLS, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: bg === '#3b3650' ? 'transparent' : bg }}>
                    <MaterialCommunityIcons name={name as never} size={30} color={bg === '#3b3650' ? '#fff' : onColor(bg)} />
                  </View>
                </Pressable>
              )}
            />
          </>
        )}
        {tab === 'emoji' && (
          <>
            <Swatches value={bg} onChange={setBg} />
            <FlatList
              data={emoji}
              numColumns={COLS}
              keyExtractor={([e]) => e}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: [e] }) => (
                <Pressable onPress={() => choose({ kind: 'emoji', emoji: e, color: bg }, bg)} style={{ flex: 1 / COLS, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 34 }}>{e}</Text>
                </Pressable>
              )}
            />
          </>
        )}
        {tab === 'upload' && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.dim, fontSize: 15, textAlign: 'center', marginBottom: 18 }}>Use any picture as the logo. It's cropped to a circle.</Text>
            <Pill label="Choose a picture" tone="accent" onPress={() => void upload()} />
          </View>
        )}
      </Column>
    </View>
  )
}
