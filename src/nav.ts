import type { NavigatorScreenParams } from '@react-navigation/native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

// The adding/editing flow is its own stack shown as a modal, so its screens push inside it.
export type FlowParams = {
  Catalog: undefined
  Edit: undefined
  Logo: undefined
  TypePaste: undefined
  Review: { source: string }
  BillingHistory: undefined
  PriceHistory: undefined
  PaymentPick: undefined
}

export type RootParams = {
  Tabs: undefined
  Flow: NavigatorScreenParams<FlowParams>
  Lists: undefined
  Categories: undefined
  PaymentMethods: undefined
  Currency: undefined
  Notifications: undefined
  Data: undefined
  WhatsNew: undefined
  Guide: undefined
  Updates: undefined
  Sync: undefined
  Appearance: undefined
  Feedback: undefined
}

export const useRootNav = () => useNavigation<NativeStackNavigationProp<RootParams>>()
export const useFlowNav = () => useNavigation<NativeStackNavigationProp<FlowParams & RootParams>>()
