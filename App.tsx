import { DarkTheme, NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Platform, View } from 'react-native'
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
import { CurrencyScreen, DataScreen, Guide, NotificationsScreen, SyncScreen, UpdatesScreen, WhatsNew } from './src/screens/more'
import { startSync, syncNow } from './src/lib/syncRunner'
import Review from './src/screens/Review'
import Settings from './src/screens/Settings'
import TypePaste from './src/screens/TypePaste'
import { OverlayHost } from './src/ui/overlays'
import { TabBar, type TabKey } from './src/ui/TabBar'
import { colors } from './src/ui/theme'

const Root = createNativeStackNavigator<RootParams>()
const Flow = createNativeStackNavigator<FlowParams>()

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } }

function Tabs() {
  const [tab, setTab] = useState<TabKey>('subs')
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
      <TabBar tab={tab} onChange={setTab} />
    </View>
  )
}

/** Adding or editing a subscription: a stack of its own, shown as a sheet. */
function FlowStack({ route }: NativeStackScreenProps<RootParams, 'Flow'>) {
  const start = (route.params as { screen?: keyof FlowParams } | undefined)?.screen ?? 'Catalog'
  return (
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
}

export default function App() {
  const loaded = useStore((s) => s.loaded)
  const subs = useStore((s) => s.subs)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    void useStore.getState().hydrate()
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
        <NavigationContainer theme={theme}>
          <Root.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Root.Screen name="Tabs" component={Tabs} />
            <Root.Screen name="Flow" component={FlowStack} options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'android' ? 'slide_from_bottom' : undefined }} />
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
          </Root.Navigator>
        </NavigationContainer>
      )}
      <OverlayHost />
    </SafeAreaProvider>
  )
}
