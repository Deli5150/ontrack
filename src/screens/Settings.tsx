import { useShallow } from 'zustand/react/shallow'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Linking from 'expo-linking'
import { Pressable, Share, Text, View } from 'react-native'
import { currencyOf } from '../lib/currency'
import { REPO_URL } from '../lib/release'
import { desktop } from '../lib/storage'
import { useStore } from '../lib/store'
import { useUpdate } from '../lib/updater'
import { useRootNav } from '../nav'
import { Group, Page, Row } from '../ui/kit'
import { colors, THEMES } from '../ui/theme'
import { VERSION } from '../version'

export const openUrl = (url: string): void => {
  if (desktop) desktop.openExternal(url)
  else void Linking.openURL(url)
}

export default function Settings() {
  const nav = useRootNav()
  const { settings, subs, sync } = useStore(useShallow((s) => ({ settings: s.settings, subs: s.subs, sync: s.sync })))
  const update = useUpdate()
  const updateValue = update.state === 'available' || update.state === 'ready' ? `${update.version} available` : `v${VERSION}`
  return (
    <Page bottomSpace={110}>
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '700', marginTop: 40, marginBottom: 14 }}>Settings</Text>
      <Group>
        <Row
          label="OnTrack"
          sub={`Unlimited subscriptions · ${subs.length} tracked`}
          accessory="none"
          right={<Ionicons name="sparkles" size={22} color={colors.accent} />}
        />
      </Group>
      <Group>
        <Row icon="color-palette-outline" label="Appearance" value={THEMES[settings.theme]?.name} onPress={() => nav.navigate('Appearance')} />
        <Row icon="globe-outline" label="Preferred currency" value={`${settings.currency} ${currencyOf(settings.currency).symbol}`} accessory="updown" onPress={() => nav.navigate('Currency')} />
        <Row icon="list" label="Lists" onPress={() => nav.navigate('Lists')} />
        <Row icon="pricetag-outline" label="Categories" onPress={() => nav.navigate('Categories')} />
        <Row icon="card-outline" label="Payment methods" onPress={() => nav.navigate('PaymentMethods')} />
      </Group>
      <Group>
        <Row icon="star-outline" label="Star on GitHub" accessory="external" onPress={() => openUrl(REPO_URL)} />
        <Row icon="share-outline" label="Share with a friend" accessory="none" onPress={() => void Share.share({ message: `I keep my subscriptions on track with OnTrack: ${REPO_URL}` })} />
      </Group>
      <Group>
        <Row icon="notifications-outline" label="Notifications" value={settings.notifications ? 'On' : 'Off'} onPress={() => nav.navigate('Notifications')} />
        <Row icon="search" label="Subscription finder guide" onPress={() => nav.navigate('Guide')} />
        <Row icon="sync" label="Sync with Google" value={sync.enabled ? 'On' : 'Off'} onPress={() => nav.navigate('Sync')} />
        <Row icon="folder-outline" label="Data" onPress={() => nav.navigate('Data')} />
      </Group>
      <Group>
        <Row icon="sparkles-outline" label="What's New" onPress={() => nav.navigate('WhatsNew')} />
        <Row icon="cloud-download-outline" label="Updates" value={updateValue} onPress={() => nav.navigate('Updates')} />
        <Row icon="chatbubble-ellipses-outline" label="Report a bug or request a feature" onPress={() => nav.navigate('Feedback')} />
        <Row icon="logo-github" label="Source code" value="GitHub" accessory="external" onPress={() => openUrl(REPO_URL)} />
      </Group>
      <Pressable onPress={() => openUrl(REPO_URL)} style={{ alignItems: 'center', marginTop: 16 }}>
        <Text style={{ color: colors.accentHi, fontSize: 17, fontWeight: '700' }}>OnTrack {VERSION}</Text>
        <Image source={require('../../assets/icon.png')} style={{ width: 54, height: 54, borderRadius: 13, marginTop: 10 }} />
      </Pressable>
    </Page>
  )
}
