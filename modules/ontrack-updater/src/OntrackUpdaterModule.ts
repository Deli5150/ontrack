import { NativeModule, requireOptionalNativeModule } from 'expo'

// Android-only (see android/…/OntrackUpdaterModule.kt); null on iPhone, which can't install apps itself.
declare class OntrackUpdaterModule extends NativeModule {
  canInstall(): boolean
  openInstallSettings(): boolean
  install(path: string): boolean
}

export default requireOptionalNativeModule<OntrackUpdaterModule>('OntrackUpdater')
