# Personal Assistant (mobile)

Android-first [Expo](https://expo.dev/) app for the Personal Assistant monorepo: chat with the assistant, tasks, reminders, local SQLite-backed data, and Supabase authentication. Routing uses [Expo Router](https://docs.expo.dev/router/introduction/).

## Prerequisites

From the **repository root** (see `AGENTS.md`):

- **Node.js** ≥ 22 (recommended: via nvm)
- Dependencies: `npm install` at the repo root (npm workspaces)
- **Shared package built**: `npm run build -w @personal-assistant/shared` (the API and mobile app depend on `@personal-assistant/shared`)

Running the Nest API locally is optional for UI-only work; assistant chat and protected flows need the API and valid Supabase credentials.

## Environment variables

Copy `.env.example` to `.env` in **this directory** (`apps/mobile`). Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the client bundle.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (auth / JWT; must align with `apps/api` Supabase config or the API will reject requests) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of the Nest API (default `http://localhost:3000`) |

Notes:

- **Android emulator**: `http://localhost` / `127.0.0.1` is rewritten to `10.0.2.2` automatically when not on a physical device, so `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` is usually enough.
- **Physical Android device**: use your machine’s LAN IP (e.g. `http://192.168.1.10:3000`), not `localhost`.
- **iOS Simulator**: `http://localhost:3000` typically works.
- **Cleartext HTTP** is enabled for Android dev builds via `expo-build-properties` in `app.json`; rebuild the native app after changing that.

For Supabase project setup and keeping the Data API off on mobile, see `docs/SUPABASE_SETUP.md` at the repo root.

## Scripts

Run from **this package** (`apps/mobile`) or via `-w @personal-assistant/mobile` from the root.

| Command | Description |
|---------|-------------|
| `npm run start` | Expo dev server (`expo start`) |
| `npm run android` | Start and open Android (`expo start --android`) |
| `npm run android:remote` | Same with LAN host (useful for some device setups) |
| `npm run ios` | Start and open iOS simulator |
| `npm run web` | Web build / dev |
| `npm run test` | Unit tests ([Vitest](https://vitest.dev/)) |
| `npm run typecheck` | `tsc --noEmit` |

From the **monorepo root**:

```bash
npm run dev:mobile
```

starts this app’s dev server (`npm run start -w @personal-assistant/mobile`).

## EAS Build

[Expo Application Services](https://docs.expo.dev/build/introduction/) profiles live in `eas.json`: `development` (dev client), `preview`, and `production`. Node for builds is pinned (see `eas.json` `build.base`). Use the EAS CLI from this directory after logging in: `eas build --profile <profile>`.

## Project layout (high level)

- `app/` — Expo Router screens (`(tabs)` for main UI, `sign-in`, etc.)
- `context/` — React context (auth, local data)
- `lib/` — API client, Supabase auth helpers, SQLite, crypto, assistant wiring, config

## Tests and CI

- `npm run test` runs Vitest with stubs for native modules where needed.
- `npm run typecheck` is the static check for this workspace; the root `npm run typecheck` runs all workspaces that define it.

Mobile UI is not exercised headlessly in CI the same way as unit tests; use an emulator or device with Expo Go or a dev client for full integration testing.
