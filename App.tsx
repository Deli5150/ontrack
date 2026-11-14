import { DarkTheme, NavigationContainer, StackActions, createNavigationContainerRef, type NavigationState } from '@react-navigation/native'
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, AppState, Platform, Pressable, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { syncReminders } from './src/lib/reminders'
import { desktop } from './src/lib/storage'
import { useStore } from './src/lib/store'
import { autoCheck, startUpdater } from './src/lib/updater'
import type { FlowParams, RootParams } from './src/nav'
import AddCatalog from './src/screens/AddCatalog'
import Calendar from './src/screens/Calendar'
import EditSub from './src/screens/EditSub'
import { BillingHistory, PriceHistory } from './src/screens/History'
import Home from './src/screens/Home'
import LogoPicker from './src/screens/LogoPicker'
import { Categories, Lists, PaymentMethods, PaymentPick } from './src/screens/manage'
import { CurrencyScreen, DataScreen, FeedbackScreen, Guide, NotificationsScreen, SyncScreen, UpdatesScreen, WhatsNew } from './src/screens/more'
import { startSync, syncNow } from './src/lib/syncRunner'
import Review from './src/screens/Review'
import Settings from './src/screens/Settings'
import TypePaste from './src/screens/TypePaste'
import { OverlayHost } from './src/ui/overlays'
import { TabBar } from './src/ui/TabBar'
import { applyTheme, colors, THEMES } from './src/ui/theme'
import { useTab, useWide } from './src/lib/layout'
import { refreshSvgl } from './src/lib/svgl'
import { loadWallpaperPhoto } from './src/lib/wallpaper'
import { Sidebar } from './src/ui/Sidebar'
import { AppearanceScreen } from './src/screens/Appearance'

const Root = createNativeStackNavigator<RootParams>()
const Flow = createNativeStackNavigator<FlowParams>()

const nav = createNavigationContainerRef<RootParams>()

function Tabs() {
  const { tab, set: setTab } = useTab()
  const wide = useWide()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, display: tab === 'subs' ? 'flex' : 'none' }}>
        <Home />
      </View>
      <View style={{ flex: 1, display: tab === 'calendar' ? 'flex' : 'none' }}>
        <Calendar />
      </View>
      <View style={{ flex: 1, display: tab === 'settings' ? 'flex' : 'none' }}>
        <Settings />
      </View>
      {!wide && <TabBar tab={tab} onChange={setTab} />}
    </View>
  )
}

/** Adding or editing a subscription: a stack of its own, shown as a sheet. */
function FlowStack({ route, navigation }: NativeStackScreenProps<RootParams, 'Flow'>) {
  const start = (route.params as { screen?: keyof FlowParams } | undefined)?.screen ?? 'Catalog'
  const wide = useWide()
  const stack = (
    <Flow.Navigator initialRouteName={start} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Flow.Screen name="Catalog" component={AddCatalog} />
      <Flow.Screen name="Edit" component={EditSub} />
      <Flow.Screen name="Logo" component={LogoPicker} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card' }} />
      <Flow.Screen
        name="TypePaste"
        component={TypePaste}
        options={Platform.OS === 'ios' ? { presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: 34 } : {}}
      />
      <Flow.Screen name="Review" component={Review} />
      <Flow.Screen name="BillingHistory" component={BillingHistory} />
      <Flow.Screen name="PriceHistory" component={PriceHistory} />
      <Flow.Screen name="PaymentPick" component={PaymentPick} />
    </Flow.Navigator>
  )
  if (!wide) return stack
  // Desktop: a dialog over the page.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Pressable onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ width: '100%', maxWidth: 620, height: '100%', maxHeight: 860, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>{stack}</View>
    </View>
  )
}

/** Desktop: the sidebar beside the screens. */
function Shell({ children }: { children: React.ReactNode }) {
  const wide = useWide()
  if (!wide) return <>{children}</>
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <Sidebar
        onTab={(t) => {
          useTab.getState().set(t)
          if (nav.isReady() && nav.canGoBack()) nav.dispatch(StackActions.popToTop())
        }}
        onAdd={() => nav.isReady() && nav.navigate('Flow', { screen: 'Catalog' })}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const subs = useStore((s) => s.subs)
  const settings = useStore((s) => s.settings)
  const wide = useWide()
  // Navigation state, kept so changing the theme (which re-creates the screens) stays where you are.
  const navState = useRef<NavigationState | undefined>(undefined)

  if (colors.name !== (THEMES[settings.theme] ?? THEMES.graphite).name) applyTheme(settings.theme)
  const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } }

  // Desktop: the page behind the app (it shows under macOS's title bar) follows the theme.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.body.style.backgroundColor = colors.bg
  }, [settings.theme])

  useEffect(() => {
    void useStore.getState().hydrate()
    void loadWallpaperPhoto()
    void refreshSvgl()
    startUpdater()
  }, [])

  useEffect(() => {
    if (loaded) syncReminders(subs, settings)
  }, [loaded, subs, settings])

  useEffect(() => {
    if (!loaded) return
    startSync()
    desktop?.updater.setAuto(settings.checkUpdates)
    autoCheck(settings.checkUpdates)
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      autoCheck(useStore.getState().settings.checkUpdates)
      void useStore.getState().refreshRates()
      void syncNow()
      syncReminders(useStore.getState().subs, useStore.getState().settings)
    })
    return () => sub.remove()
  }, [loaded, settings.checkUpdates])

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {!loaded ? (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Shell key={`${settings.theme}-${wide}`}>
        <NavigationContainer ref={nav} theme={theme} initialState={navState.current} onStateChange={(st) => (navState.current = st)}>
          <Root.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Root.Screen name="Tabs" component={Tabs} />
            <Root.Screen
              name="Flow"
              component={FlowStack}
              options={
                wide
                  ? { presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }
                  : { presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'android' ? 'slide_from_bottom' : undefined }
              }
            />
            <Root.Screen name="Lists" component={Lists} />
            <Root.Screen name="Categories" component={Categories} />
            <Root.Screen name="PaymentMethods" component={PaymentMethods} />
            <Root.Screen name="Currency" component={CurrencyScreen} />
            <Root.Screen name="Notifications" component={NotificationsScreen} />
            <Root.Screen name="Data" component={DataScreen} />
            <Root.Screen name="WhatsNew" component={WhatsNew} />
            <Root.Screen name="Guide" component={Guide} />
            <Root.Screen name="Updates" component={UpdatesScreen} />
            <Root.Screen name="Sync" component={SyncScreen} />
            <Root.Screen name="Appearance" component={AppearanceScreen} />
            <Root.Screen name="Feedback" component={FeedbackScreen} />
          </Root.Navigator>
        </NavigationContainer>
        </Shell>
      )}
      <OverlayHost />
    </SafeAreaProvider>
  )
}
