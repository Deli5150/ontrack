import type { ExpoConfig } from 'expo/config'
import { version } from './package.json'

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ''

// Android's versionCode from the version: 1.2.3 → 10203.
const [major, minor, patch] = version.split('.').map(Number)

const config: ExpoConfig = {
  name: 'OnTrack',
  slug: 'ontrack',
  scheme: 'ontrack',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0c0c0d',
  ios: {
    bundleIdentifier: 'app.ontrack.subscriptions',
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'OnTrack reads receipts and renewal screenshots you pick to find your subscriptions, and lets you use a picture as a logo.',
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: 'app.ontrack.subscriptions',
    versionCode: major * 10000 + minor * 100 + patch,
    adaptiveIcon: { backgroundColor: '#1e1e21', foregroundImage: './assets/android-icon-foreground.png', monochromeImage: './assets/android-icon-monochrome.png' },
    permissions: ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'REQUEST_INSTALL_PACKAGES'],
    predictiveBackGestureEnabled: false
  },
  web: { favicon: './assets/favicon.png', output: 'single', bundler: 'metro' },
  plugins: [
    // First, so it runs after expo-notifications has added the push entitlement.
    './plugins/withoutPushEntitlement',
    ['expo-notifications', { color: '#8b7cf6' }],
    ['expo-image-picker', { photosPermission: 'OnTrack reads receipts and renewal screenshots you pick to find your subscriptions.' }],
    'expo-sharing',
    'expo-localization',
    'expo-image',
    './plugins/withReleaseSigning',
    './plugins/withoutCodeShrinking',
    // Google's sign-in on iPhone needs its client's URL scheme (Sync with Google).
    ...(IOS_CLIENT_ID ? [['@react-native-google-signin/google-signin', { iosUrlScheme: IOS_CLIENT_ID.split('.').reverse().join('.') }] as [string, object]] : ['@react-native-google-signin/google-signin'])
  ]
}

export default config
