import { useShallow } from 'zustand/react/shallow'
import { Ionicons } from '@expo/vector-icons'
import { googleAvailable } from '../lib/google'
import { syncNow, turnOffSync, turnOnSync, useSyncBusy } from '../lib/syncRunner'
import * as DocumentPicker from 'expo-document-picker'
import { cacheDirectory, EncodingType, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import { CHANGELOG } from '../data/changelog'
import { CURRENCIES } from '../lib/currency'
import { cycleLabel, formatDate, nextPayment } from '../lib/dates'
import { exportData, normalize, useStore } from '../lib/store'
import { testNotification } from '../lib/reminders'
import { feedbackUrl, type FeedbackKind } from '../lib/feedback'
import { RELEASES_PAGE, REPO_URL } from '../lib/release'
import { desktop } from '../lib/storage'
import type { AppData } from '../lib/types'
import { checkForUpdates, downloadUpdate, installUpdate, useUpdate } from '../lib/updater'
import { Field, Group, Header, Page, Row, SectionLabel, SearchField, Segmented, Toggle } from '../ui/kit'
import { confirm, showMenu } from '../ui/overlays'
import { colors } from '../ui/theme'
import { VERSION } from '../version'
import { NOTIFY_OPTIONS, notifyLabel } from './EditSub'
import { openUpdatePrompt } from '../ui/UpdatePrompt'
import { openUrl } from './Settings'

export function CurrencyScreen() {
  const { settings, setSettings } = useStore(useShallow((s) => ({ settings: s.settings, setSettings: s.setSettings })))
  const [q, setQ] = useState('')
  const list = CURRENCIES.filter((c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page header={<Header title="Preferred currency" />}>
      <SearchField value={q} onChange={setQ} placeholder="Search currencies" style={{ marginBottom: 14 }} />
      <Text style={{ color: colors.dim, marginBottom: 12, fontSize: 13 }}>Totals are shown in this currency. Subscriptions in other currencies are converted at today’s rate.</Text>
      <Group>
        {list.map((c) => (
          <Row
            key={c.code}
            label={`${c.code} · ${c.name}`}
            value={c.symbol}
            accessory="none"
            onPress={() => setSettings({ currency: c.code })}
            right={settings.currency === c.code ? <Ionicons name="checkmark" size={20} color={colors.accentHi} style={{ marginLeft: 8 }} /> : <View style={{ width: 28 }} />}
          />
        ))}
      </Group>
    </Page>
  )
}

const TIMES = ['07:00', '08:00', '09:00', '10:00', '12:00', '15:00', '18:00', '20:00', '21:00']
const timeLabel = (t: string): string => {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function NotificationsScreen() {
  const { settings, setSettings, subs } = useStore(useShallow((s) => ({ settings: s.settings, setSettings: s.setSettings, subs: s.subs })))
  const [tested, setTested] = useState<string | null>(null)
  return (
    <Page header={<Header title="Notifications" />}>
      <Group>
        <Row label="Payment reminders" accessory="none" right={<Toggle value={settings.notifications} onChange={(notifications) => setSettings({ notifications })} />} />
        <Row label="Time" value={timeLabel(settings.notifyTime)} accessory="updown" onPress={() => showMenu('Remind me at', TIMES.map((t) => ({ label: timeLabel(t), selected: t === settings.notifyTime, onPress: () => setSettings({ notifyTime: t }) })))} />
        <Row
          label="Default for new subscriptions"
          value={notifyLabel(settings.defaultNotify)}
          accessory="updown"
          onPress={() => showMenu('New subscriptions remind me', NOTIFY_OPTIONS.map((o) => ({ label: o.label, selected: o.value === settings.defaultNotify, onPress: () => setSettings({ defaultNotify: o.value }) })))}
        />
      </Group>
      <Group>
        <Row
          label="Use the default for all subscriptions"
          sub={`Sets every subscription to “${notifyLabel(settings.defaultNotify)}”`}
          accessory="none"
          onPress={() => confirm('Change every reminder?', `All ${subs.length} subscriptions will remind “${notifyLabel(settings.defaultNotify)}”.`, 'Change all', () => useStore.setState((s) => ({ subs: s.subs.map((x) => ({ ...x, notify: settings.defaultNotify })) })))}
        />
        <Row label="Send a test notification" accessory="none" onPress={() => void testNotification().then((ok) => setTested(ok ? 'Sent. It should arrive in a moment.' : 'Notifications are blocked. Allow them for OnTrack in your system settings.'))} />
      </Group>
      {tested && <Text style={{ color: colors.dim, textAlign: 'center' }}>{tested}</Text>}
      <Text style={{ color: colors.faint, fontSize: 13, marginTop: 10, lineHeight: 18 }}>
        {desktop ? 'On the desktop, reminders arrive while OnTrack is open (it keeps running in the background after you close the window).' : 'Reminders are scheduled on this device for the next two months and refreshed every time you open OnTrack.'}
      </Text>
    </Page>
  )
}

async function saveText(name: string, content: string, mime: string): Promise<void> {
  if (desktop) {
    await desktop.saveFile(name, content)
    return
  }
  if (Platform.OS === 'web') {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type: mime }))
    a.download = name
    a.click()
    return
  }
  const uri = `${cacheDirectory}${name}`
  await writeAsStringAsync(uri, content)
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name })
}

const csvCell = (v: string | number): string => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function DataScreen() {
  const { subs, replaceAll, eraseAll, lists, categories } = useStore(useShallow((s) => ({ subs: s.subs, replaceAll: s.replaceAll, eraseAll: s.eraseAll, lists: s.lists, categories: s.categories })))
  const [note, setNote] = useState<string | null>(null)
  const stamp = new Date().toISOString().slice(0, 10)

  const exportJson = () => void saveText(`OnTrack-${stamp}.json`, JSON.stringify(exportData(), null, 2), 'application/json')
  const exportCsv = () => {
    const rows = [
      ['Name', 'Price', 'Currency', 'Cycle', 'Next payment', 'First payment', 'List', 'Category', 'Status', 'URL', 'Notes'],
      ...subs.map((s) => [
        s.name,
        s.price,
        s.currency,
        s.type === 'once' ? 'One-time' : cycleLabel(s.cycle),
        nextPayment(s) ?? '',
        s.startDate,
        lists.find((l) => l.id === s.listId)?.name ?? '',
        categories.find((c) => c.id === s.categoryId)?.name ?? '',
        s.cancelledAt ? `Cancelled ${s.cancelledAt}` : 'Active',
        s.url,
        s.notes
      ])
    ]
    void saveText(`OnTrack-${stamp}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }
  const importJson = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true })
    if (res.canceled) return
    const asset = res.assets[0]
    try {
      const text = asset.file ? await asset.file.text() : await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 })
      const data = normalize(JSON.parse(text) as Partial<AppData>)
      confirm('Replace your data?', `This backup has ${data.subs.length} subscriptions. What’s in OnTrack now is replaced.`, 'Replace', () => {
        replaceAll(data)
        setNote(`Restored ${data.subs.length} subscriptions.`)
      })
    } catch {
      setNote('That file isn’t an OnTrack backup.')
    }
  }

  return (
    <Page header={<Header title="Data" />}>
      <SectionLabel>Backup</SectionLabel>
      <Group>
        <Row icon="download-outline" label="Export backup" sub="Everything, as a JSON file" onPress={exportJson} />
        <Row icon="push-outline" label="Restore backup" sub="From an OnTrack JSON file" onPress={() => void importJson()} />
        <Row icon="grid-outline" label="Export spreadsheet" sub="Subscriptions as CSV" onPress={exportCsv} />
      </Group>
      {note && <Text style={{ color: colors.dim, textAlign: 'center', marginBottom: 14 }}>{note}</Text>}
      <Group>
        <Row icon="trash-outline" iconColor={colors.danger} label="Erase all data" danger accessory="none" onPress={() => confirm('Erase everything?', 'Every subscription, list, category and payment method is deleted. Export a backup first if you might want them.', 'Erase all', eraseAll)} />
      </Group>
      <Text style={{ color: colors.faint, fontSize: 13, lineHeight: 18 }}>Your data stays on this device. Nothing is sent anywhere except to fetch logos and exchange rates.</Text>
    </Page>
  )
}

export function WhatsNew() {
  return (
    <Page header={<Header title="What's New" />}>
      {CHANGELOG.map((v) => (
        <View key={v.version} style={{ marginBottom: 20 }}>
          <SectionLabel>{`Version ${v.version} · ${formatDate(v.date)}`}</SectionLabel>
          <Group>
            {v.items.map((item, i) => (
              <Row key={i} label={item} icon="sparkles" iconColor={colors.accentHi} />
            ))}
          </Group>
        </View>
      ))}
    </Page>
  )
}

const GUIDE: Array<{ title: string; sub: string; url?: string }> = [
  { title: 'App Store subscriptions', sub: 'iPhone: Settings → your name → Subscriptions', url: 'https://apps.apple.com/account/subscriptions' },
  { title: 'Google Play subscriptions', sub: 'Play Store → profile → Payments & subscriptions', url: 'https://play.google.com/store/account/subscriptions' },
  { title: 'PayPal automatic payments', sub: 'Settings → Payments → Manage automatic payments', url: 'https://www.paypal.com/myaccount/autopay/' },
  { title: 'Amazon memberships', sub: 'Prime, Kindle Unlimited, Audible, channels', url: 'https://www.amazon.com/yourmembershipsandsubscriptions' },
  { title: 'Bank & card statements', sub: 'Download the last 3 months as CSV and use Import a file' },
  { title: 'Search your email', sub: 'Try “receipt”, “renewal”, “subscription”, “your plan”, “trial ends”' },
  { title: 'Phone, internet & utilities', sub: 'Carrier, broadband, streaming bundles, insurance' },
  { title: 'Saved cards in your browser', sub: 'Sites with your card saved often bill you regularly' }
]

export function Guide() {
  return (
    <Page header={<Header title="Subscription finder" />}>
      <Text style={{ color: colors.dim, fontSize: 15, marginBottom: 16, lineHeight: 21 }}>Places subscriptions hide. Check each one and add what you find, or import a statement to find repeated charges automatically.</Text>
      <Group>
        {GUIDE.map((g) => (
          <Row key={g.title} label={g.title} sub={g.sub} accessory={g.url ? 'external' : 'none'} onPress={g.url ? () => openUrl(g.url!) : undefined} />
        ))}
      </Group>
    </Page>
  )
}

export function UpdatesScreen() {
  const u = useUpdate()
  const { settings, setSettings } = useStore(useShallow((s) => ({ settings: s.settings, setSettings: s.setSettings })))
  const busy = u.state === 'checking' || u.state === 'downloading' || u.state === 'installing'
  const message =
    u.state === 'checking'
      ? 'Checking…'
      : u.state === 'latest'
        ? 'OnTrack is up to date.'
        : u.state === 'available'
          ? `Version ${u.version} is available.`
          : u.state === 'downloading'
            ? `Downloading ${Math.round((u.progress ?? 0) * 100)}%`
            : u.state === 'ready'
              ? `Version ${u.version} is ready to install.`
              : u.state === 'installing'
                ? 'Installing… OnTrack will restart.'
                : u.state === 'error'
                  ? u.error
                  : 'Check for a new version.'
  const isIos = Platform.OS === 'ios' && !desktop
  return (
    <Page header={<Header title="Updates" />}>
      <View style={{ alignItems: 'center', marginVertical: 22 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>OnTrack {VERSION}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          {busy && <ActivityIndicator color={colors.accentHi} style={{ marginRight: 8 }} />}
          <Text style={{ color: u.state === 'error' ? colors.danger : colors.dim, fontSize: 15, textAlign: 'center' }}>{message}</Text>
        </View>
        {u.error && u.state !== 'error' && <Text style={{ color: colors.danger, marginTop: 6, textAlign: 'center' }}>{u.error}</Text>}
      </View>
      <Group>
        {isIos && (u.state === 'available' || u.state === 'ready') ? (
          <Row icon="cloud-download" iconColor={colors.accentHi} label={`Update to ${u.version}`} sub="AltStore, SideStore, Feather, FlareStore or the .ipa" onPress={() => openUpdatePrompt('choose')} />
        ) : (u.state === 'available' && u.inApp) || u.state === 'ready' ? (
          u.state === 'ready' ? (
            <Row icon="checkmark-circle" iconColor={colors.success} label={isIos ? 'Save the new app (.ipa)' : 'Install and restart'} accessory="none" onPress={() => void installUpdate()} />
          ) : (
            <Row icon="cloud-download" iconColor={colors.accentHi} label={`Download ${u.version}`} accessory="none" onPress={() => void downloadUpdate()} />
          )
        ) : u.state === 'available' ? (
          <Row icon="open-outline" label="Open the download page" accessory="external" onPress={() => openUrl(u.page ?? RELEASES_PAGE)} />
        ) : (
          <Row icon="refresh" label="Check for updates" accessory="none" onPress={() => void checkForUpdates()} />
        )}
        <Row label="Check automatically" accessory="none" right={<Toggle value={settings.checkUpdates} onChange={(checkUpdates) => setSettings({ checkUpdates })} />} />
      </Group>
      {u.notes && (u.state === 'available' || u.state === 'ready') ? (
        <>
          <SectionLabel>{`What's new in ${u.version}`}</SectionLabel>
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, lineHeight: 21 }}>{u.notes.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}</Text>
          </View>
        </>
      ) : null}
      {isIos && <Text style={{ color: colors.faint, fontSize: 13, marginTop: 14, lineHeight: 18 }}>An iPhone can’t install apps by itself: AltStore, SideStore, Feather or FlareStore installs the new version for you, or download the .ipa and sideload it as before.</Text>}
      <Row label="All releases" accessory="external" onPress={() => openUrl(RELEASES_PAGE)} />
    </Page>
  )
}

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return formatDate(new Date(ms).toISOString().slice(0, 10))
}

export function SyncScreen() {
  const sync = useStore((s) => s.sync)
  const busy = useSyncBusy()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const turnOn = async () => {
    setError(null)
    setWorking(true)
    try {
      await turnOnSync()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Page header={<Header title="Sync with Google" />}>
      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <Ionicons name={sync.enabled ? 'cloud-done' : 'cloud-outline'} size={48} color={sync.enabled ? colors.accentHi : colors.dim} />
        <Text style={{ color: colors.dim, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
          Keep your subscriptions the same on every device: your Mac or PC, iPhone and Android. OnTrack keeps them in a private folder in your Google Drive that only OnTrack can see.
        </Text>
      </View>
      {sync.enabled ? (
        <>
          <Group>
            <Row label="Signed in as" value={sync.email ?? 'Google account'} accessory="none" />
            <Row label="Last synced" value={busy ? 'Syncing…' : sync.lastSync ? ago(sync.lastSync) : 'Not yet'} accessory="none" right={busy ? <ActivityIndicator color={colors.accentHi} style={{ marginLeft: 8 }} /> : undefined} />
            <Row label="Sync now" icon="refresh" iconColor={colors.accentHi} accessory="none" onPress={() => void syncNow()} />
          </Group>
          {sync.error && <Text style={{ color: colors.danger, textAlign: 'center', marginBottom: 14 }}>{sync.error}</Text>}
          <Group>
            <Row label="Turn off Sync" danger accessory="none" onPress={() => confirm('Turn off Sync?', 'This device stops syncing and signs out of Google. Your subscriptions stay here and in your other devices.', 'Turn off', () => void turnOffSync())} />
          </Group>
        </>
      ) : (
        <>
          <Group>
            <Row label={working ? 'Waiting for Google…' : 'Sign in with Google'} icon="logo-google" iconColor={colors.accentHi} accessory="none" onPress={working ? undefined : () => void turnOn()} right={working ? <ActivityIndicator color={colors.accentHi} /> : undefined} />
          </Group>
          {error && <Text style={{ color: colors.danger, textAlign: 'center', marginBottom: 14 }}>{error}</Text>}
          {desktop && <Text style={{ color: colors.faint, fontSize: 13, textAlign: 'center' }}>Google’s sign-in opens in your browser. Come back here when it’s done.</Text>}
          {!googleAvailable() && <Text style={{ color: colors.faint, fontSize: 13, textAlign: 'center', marginTop: 8 }}>This copy of OnTrack was built without a Google client, so Sync isn’t available.</Text>}
        </>
      )}
    </Page>
  )
}

export function FeedbackScreen() {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const ready = title.trim().length > 2 && text.trim().length > 2
  return (
    <Page header={<Header title="Feedback" />}>
      <Segmented<FeedbackKind>
        value={kind}
        onChange={setKind}
        options={[
          { label: 'Report a bug', value: 'bug' },
          { label: 'Request a feature', value: 'feature' }
        ]}
      />
      <Text style={{ color: colors.dim, fontSize: 14, marginVertical: 14, lineHeight: 20 }}>
        {kind === 'bug'
          ? 'Say what you did, what you expected, and what happened instead. Your OnTrack version and device are added for you.'
          : 'What should OnTrack do, and why would it help?'}
      </Text>
      <Field value={title} onChangeText={setTitle} placeholder={kind === 'bug' ? 'Short summary, e.g. "Calendar skips February"' : 'Short summary, e.g. "Widgets"'} style={{ marginBottom: 12 }} />
      <Field value={text} onChangeText={setText} placeholder={kind === 'bug' ? 'What happened' : 'The idea'} multiline style={{ marginBottom: 18, minHeight: 160 }} />
      <Group>
        <Row
          label="Continue on GitHub"
          sub="Opens the filled-in form; submit it there with your GitHub account"
          icon="logo-github"
          iconColor={ready ? colors.accentHi : colors.faint}
          accessory="external"
          onPress={ready ? () => openUrl(feedbackUrl(kind, title, text, VERSION)) : undefined}
        />
      </Group>
      <Group>
        <Row label="See open reports and ideas" icon="list" accessory="external" onPress={() => openUrl(`${REPO_URL}/issues`)} />
      </Group>
    </Page>
  )
}
