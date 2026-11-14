import { brandLogo } from '../lib/svgl'
import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ALL_SERVICES, CATALOG, type Service } from '../data/catalog'
import { categoryIdFor } from '../lib/defaults'
import { startNew, useDraft } from '../lib/draft'
import { importFromFile, importFromPhotos, ImportError } from '../lib/importers'
import type { Draft } from '../lib/parse'
import { useStore } from '../lib/store'
import { useFlowNav } from '../nav'
import { CircleButton, Column, Screen, SearchField, type IconName } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { showMenu } from '../ui/overlays'
import { colors } from '../ui/theme'

function Option({ icon, title, sub, onPress, busy }: { icon: IconName; title: string; sub?: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, opacity: pressed ? 0.6 : 1, borderBottomWidth: 1, borderColor: colors.separator })}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentDeep, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={icon} size={17} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 17 }}>{title}</Text>
        {sub && <Text style={{ color: colors.dim, fontSize: 13, marginTop: 1 }}>{sub}</Text>}
      </View>
    </Pressable>
  )
}

function ServiceRow({ svc, onPress }: { svc: Service; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, opacity: pressed ? 0.6 : 1, borderBottomWidth: 1, borderColor: colors.separator })}>
      <Logo logo={brandLogo(svc.name, svc.domain)} name={svc.name} color={svc.color} size={32} />
      <Text style={{ color: colors.text, fontSize: 17, marginLeft: 14, flex: 1 }}>{svc.name}</Text>
    </Pressable>
  )
}

export default function AddCatalog() {
  const nav = useFlowNav()
  const insets = useSafeAreaInsets()
  const currency = useStore((s) => s.settings.currency)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<'photo' | 'file' | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return ALL_SERVICES.filter((s) => s.name.toLowerCase().includes(q) || s.domain.includes(q))
  }, [query])

  const pick = (svc: Service) => {
    startNew({
      name: svc.name,
      price: svc.price,
      logo: brandLogo(svc.name, svc.domain),
      color: svc.color,
      categoryId: categoryIdFor(svc.category),
      cycle: svc.yearly ? { every: 1, unit: 'year' } : { every: 1, unit: 'month' },
      url: svc.domain
    })
    nav.navigate('Edit')
  }

  const custom = (name = '') => {
    startNew({ name })
    nav.navigate('Edit')
  }

  const runImport = async (kind: 'photo' | 'file') => {
    setBusy(kind)
    try {
      const found: Draft[] | null = kind === 'photo' ? await importFromPhotos(currency) : await importFromFile(currency)
      if (!found) return
      useDraft.setState({ found })
      nav.navigate('Review', { source: kind === 'photo' ? 'your photos' : 'that file' })
    } catch (e) {
      showMenu(e instanceof ImportError ? "Can't import that" : 'Import failed', [], (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Column style={{ flexDirection: 'row', alignItems: 'center', height: 60, marginTop: 4 }}>
        <View style={{ flex: 1 }} />
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Add Subscription</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <CircleButton icon="close" onPress={() => nav.getParent()?.goBack()} label="Close" />
        </View>
      </Column>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <Column>
          {results ? (
            <>
              {results.map((svc) => (
                <ServiceRow key={svc.name} svc={svc} onPress={() => pick(svc)} />
              ))}
              <Option icon="add" title={`Add “${query.trim()}”`} sub="As a custom subscription" onPress={() => custom(query.trim())} />
            </>
          ) : (
            <>
              <Option icon="images" title="Import from photos" sub="Receipt, bill or renewal screenshots" onPress={() => void runImport('photo')} busy={busy === 'photo'} />
              <Option icon="document-text" title="Import a file" sub="Bank statement or spreadsheet (PDF or CSV)" onPress={() => void runImport('file')} busy={busy === 'file'} />
              <Option icon="sparkles" title="Type or paste" sub="Name, price and how often you pay" onPress={() => nav.navigate('TypePaste')} />
              <Option icon="add" title="Custom subscription" onPress={() => custom()} />
              {Object.entries(CATALOG).map(([group, services]) => (
                <View key={group} style={{ marginTop: 26 }}>
                  <Text style={{ color: colors.dim, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{group}</Text>
                  {services.map((svc) => (
                    <ServiceRow key={svc.name} svc={svc} onPress={() => pick(svc)} />
                  ))}
                </View>
              ))}
            </>
          )}
        </Column>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 14 }}>
        <Column>
          <SearchField value={query} onChange={setQuery} placeholder="Search" style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(40,37,52,0.96)', borderWidth: 1, borderColor: colors.border }} />
        </Column>
      </View>
    </KeyboardAvoidingView>
    </Screen>
  )
}
