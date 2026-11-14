# OnTrack

Subscription manager (modelled on the iOS app "Orbit") for macOS, Windows, Linux, iOS and Android.
See README.md for features, layout and build commands.

## Architecture decisions

- One Expo SDK 58 / React Native codebase. Desktop = `expo export --platform web` wrapped in Electron
  (`desktop/`, plain CommonJS, served over `app://`). Because of the Electron wrapper the app uses
  `@react-navigation/native-stack` directly, not Expo Router (no URL routing to break under `app://`).
- All data is one JSON document (`src/lib/store.ts`, zustand); desktop saves it to
  `userData/ontrack.json` through `window.ontrack` (`src/lib/storage.ts` DesktopBridge ↔ `desktop/preload.cjs`).
- Dates are local `YYYY-MM-DD` strings; payment dates are always computed from `startDate` + cycle
  (`src/lib/dates.ts`), never stored.
- Sync with Google (`src/lib/sync.ts`): per-entry last-write-wins with tombstones; the store stamps
  changes in `sync.at` / `sync.removed`; `applySynced` applies merges without re-stamping.
- Updater: GitHub Releases of Deli5150/ontrack; asset names must match the patterns in
  `desktop/updater.cjs` and `src/lib/updater.ts`.
- `ios/` and `android/` are generated (`expo prebuild`); configure native things in `app.config.ts` and `plugins/`.

## Before finishing a change

`npm run typecheck`, `npm test`, and for UI changes `npm run desktop` (screenshots hook:
`ONTRACK_SHOTS=<dir> ONTRACK_SHOT_STEPS="name:click text,…" electron .` in desktop/).
