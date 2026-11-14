# OnTrack

Subscription manager (inspired by the iOS app "Orbit", but with its own look) for macOS, Windows, Linux, iOS and Android.
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
- Themes: `colors` in `src/ui/theme.ts` is one mutable object; App.tsx calls applyTheme and re-keys the
  tree on theme change (navigation state is kept). Use `colors.*`, never hard-coded accents; text on
  `colors.accent` uses `colors.onAccent`.
- Layout: `useWide()` (web, ≥860px) = desktop layout (Sidebar, two-pane Home/Calendar, add/edit as a
  dialog). Every screen goes in `<Screen>` (native SafeAreaView top edge, so sheets aren't padded twice).
- Logos: SVGL via jsDelivr (`src/lib/svgl.ts`; the api.svgl.app API is behind a bot check). Bundled
  index `src/data/svgl.json` (refresh: `npx tsx scripts/svgl.mjs`).
- `ios/` and `android/` are generated (`expo prebuild`); configure native things in `app.config.ts` and `plugins/`.

## Before finishing a change

`npm run typecheck`, `npm test`, and for UI changes `npm run desktop` (screenshots hook:
`ONTRACK_SHOTS=<dir> ONTRACK_SHOT_STEPS="name:click text,…" electron .` in desktop/).
