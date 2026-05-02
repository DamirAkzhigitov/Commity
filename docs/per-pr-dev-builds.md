# Per-PR Dev Builds: Options And Recommendation

## Goal
For every pull request, automatically produce reviewable artifacts so a
reviewer can:

- Install or open the **mobile app** as a working dev build (downloadable APK
  and/or a shared install URL) wired against the matching backend.
- Hit the **backend API** at a stable, PR-scoped public URL.

This document compares hosting/build options, lists trade-offs, and
recommends a concrete pipeline. It is planning-only; no infra is created here.

## Repo Constraints That Shape The Options

- Monorepo with three workspaces: `apps/api` (NestJS), `apps/mobile`
  (Expo/React Native), `packages/shared`. The shared package must be built
  before the API runs (`apps/api/tsconfig` references `dist/`).
- The mobile app uses native modules — `expo-secure-store`, `expo-sqlite`,
  `expo-file-system`, `expo-crypto`, `expo-notifications` (planned). It
  therefore needs a **development build / custom dev client**, not Expo Go.
- The mobile bundle reads `EXPO_PUBLIC_API_BASE_URL`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` at build time
  (see `apps/mobile/.env.example`). The API URL must be injected per PR.
- API requires Postgres + Supabase Auth (`SUPABASE_URL`, `SUPABASE_JWT_AUD`,
  `DATABASE_URL`) and optionally `OPENAI_API_KEY` (mock mode otherwise).
- Backend hosting target is Railway (chosen in
  `docs/current-state-and-next-steps.md`). Database direction: Supabase
  Postgres for shared infra-only data.
- No Android keystore is committed (`docs/git-workflow.md`); signing must be
  managed by the build service.

## Mobile Distribution Options

### Option A — EAS Build + Internal Distribution (recommended)
Expo's first-party build cloud. A GitHub Action runs `eas build` with a
`preview` profile per PR; EAS produces a signed APK and a shareable install
URL/QR.

- Pros
  - Native dependencies are supported out of the box (no Gradle plumbing).
  - Built-in install pages, QR codes, and `eas-cli` PR commenting via
    `expo-github-action`.
  - Build credentials (Android keystore) managed by EAS — no secrets in repo.
  - `eas build:profile=preview` gives `apk` artifacts (vs `aab` for store).
  - `EXPO_PUBLIC_*` env vars can be injected per build via `eas.json` env or
    `--env-file` so each PR points at its own backend URL.
  - Plays well with EAS Update for JS-only PR follow-ups.
- Cons
  - Costs build minutes on the paid tier above free monthly cap (currently
    30 builds/mo). Queue times on free.
  - Requires an Expo account/token as a GitHub secret.
- Outcome
  - Reviewer scans QR or opens the install URL → APK downloads/installs →
    app talks to PR-specific API.

### Option B — Self-hosted Android build in GitHub Actions + Firebase App Distribution
Run `expo prebuild` then Gradle `assembleRelease` (or `eas build --local`) on
a GHA Linux runner; upload the APK to Firebase App Distribution (free) or as
a GitHub Release asset; comment install link on the PR.

- Pros
  - No third-party build service spend; uses GHA minutes only.
  - APKs can be attached directly to the PR (download artifact link).
  - Firebase App Distribution gives tester groups, install tracking, and
    works on Android without enrollment.
- Cons
  - Android builds are slow (8–15 min per PR) and consume GHA minutes.
  - We must store and rotate the Android keystore + Firebase service account
    JSON as repo secrets.
  - More YAML and Gradle troubleshooting (NDK, JDK, Hermes prebuilt issues).
  - No managed credentials — every Expo SDK upgrade may require fixes.
- Outcome
  - Reviewer downloads APK from Firebase distribution email or GHA artifact.

### Option C — EAS Update channel per PR (JS-only deltas)
Once a base development build is installed once on a tester device, JS
changes in a PR can be shipped via an EAS Update channel named after the PR
(e.g. `pr-123`). The dev client picks the channel.

- Pros
  - Seconds, not minutes. No native rebuild.
  - Free for low traffic.
- Cons
  - Useless for native changes (new native module, `app.json` changes, env
    that is bundled in native, etc.). PRs that touch native still need a
    full APK from Option A or B.
  - Requires a one-time install of a base dev client on each reviewer device
    and per-channel selection UX.
- Outcome
  - Best as a **complement** to Option A, not a replacement. Use it for
    rapid JS PRs after the base dev client is installed.

### Option D — Expo Web preview URL
Build the mobile app as web (`expo export --platform web`) and publish it
behind a stable URL per PR (e.g. Vercel, Netlify, Cloudflare Pages preview).

- Pros
  - "Open the URL" UX is the easiest possible review.
  - Free preview tier on Vercel/Netlify/Cloudflare.
- Cons
  - We use **native-only** modules. `expo-secure-store` and `expo-sqlite`
    do not have first-class web equivalents in this stack; auth session and
    local-first storage will not behave the same as on Android.
  - Reviewing Android-specific UX (notifications, edge-to-edge, predictive
    back) is impossible on web.
- Outcome
  - Not viable as the primary option for this product. Could be added later
    for purely visual/JS-shape review of components that are web-safe.

### Mobile Recommendation
Adopt **Option A (EAS Build, preview profile, internal distribution)** as the
primary mechanism, with **Option C** layered in for JS-only follow-up
commits on the same PR. Defer Option B unless we hit EAS pricing limits.

## Backend Hosting Options For Per-PR Previews

The backend already targets Railway. Below evaluates Railway alongside the
realistic alternatives that natively support PR/preview environments.

### Option 1 — Railway PR Environments (recommended)
Railway has a GitHub integration that, when enabled, deploys a new
environment for each PR with its own URL (`<service>-pr-<n>.up.railway.app`)
and tears it down when the PR closes.

- Pros
  - Already the chosen production host — same image, fewer moving parts.
  - Auto-injects per-PR `RAILWAY_PUBLIC_DOMAIN`, which we can pipe into
    EAS as the `EXPO_PUBLIC_API_BASE_URL`.
  - Service variables can be inherited from a "dev" base environment, with
    PR overrides.
  - Build from the monorepo using a Railway service rooted at `apps/api`
    plus a `RAILWAY_BUILD_COMMAND` that runs the shared package build first.
- Cons
  - PR Environments are a paid plan feature.
  - Per-PR Postgres still needs a story (see "Database" below).

### Option 2 — Render PR Previews
Render also supports preview environments via `render.yaml` with
`previewsEnabled: true`. Each PR gets its own URL.

- Pros
  - Mature preview environments, simple Blueprint config.
  - Free Postgres (small) for previews.
- Cons
  - Means running production on Railway and previews on Render, which adds
    config drift.
  - Render previews on free plan have cold starts.

### Option 3 — Fly.io per-PR apps
Use a GitHub Action (`superfly/fly-pr-review-apps` or hand-rolled) to
`fly launch` an ephemeral app per PR.

- Pros
  - Cheap, geo-flexible, Docker-native.
  - Good for long-lived WebSocket/HTTP services.
- Cons
  - More YAML to maintain; per-PR Postgres requires Fly Postgres (now
    Supabase-recommended) or external Neon.
  - Diverges from chosen production host.

### Option 4 — Vercel/Cloudflare Workers (serverless)
Wrap NestJS in a serverless adapter. Vercel/Cloudflare give free PR
previews.

- Pros
  - Free and instant previews per PR.
- Cons
  - NestJS is not a great fit for serverless — cold starts, payload limits,
    background jobs, Prisma cold-start cost.
  - Diverges from the production model and may hide bugs that only show in
    long-lived servers.

### Backend Recommendation
**Option 1 — Railway PR Environments**, because production is already
Railway and PR-vs-prod parity matters more than saving a few dollars.

## Database Strategy For Per-PR Backends

The API requires Postgres and Supabase Auth.

- **Auth (Supabase)**: a single shared dev Supabase project is fine for all
  PR environments. Mobile preview builds and PR API instances use the same
  `SUPABASE_URL` so JWTs validate. Production Supabase project stays
  separate. Optional: Supabase Branching for higher-fidelity PR isolation.
- **Postgres**: three viable patterns, in order of preference:
  1. **Neon Postgres branches per PR.** Neon has a free tier with branch
     creation. A GitHub Action creates a branch on PR open, sets
     `DATABASE_URL` on the Railway PR environment, runs
     `npx prisma migrate deploy`, and deletes the branch on close. Best
     isolation, near-zero cost.
  2. **Single shared dev Postgres** on Railway/Supabase. Simpler, but PRs
     share state and migrations from one PR can break another. Acceptable
     for early MVP volume.
  3. **Ephemeral Postgres in the same Railway project.** Railway can spin
     up Postgres alongside the PR app. Easiest config, costs more, takes
     longer per PR.

Recommended start: shared dev Postgres (#2). Move to Neon branches (#1) once
PR volume grows.

## Wiring Mobile ↔ Backend Per PR

The mobile preview must point at the matching API URL. Proposed flow:

1. PR opens.
2. GitHub Action `api-preview` triggers Railway redeploy via
   `railway up --service api` (or via Railway's GitHub integration). It
   captures the preview URL from Railway's GraphQL/CLI output and writes it
   into a job output.
3. GitHub Action `mobile-preview` consumes that URL and runs:

   ```bash
   eas build \
     --profile preview \
     --platform android \
     --non-interactive \
     --no-wait \
     --message "PR #${{ github.event.number }}"
   ```

   with environment:

   ```
   EXPO_PUBLIC_API_BASE_URL=<railway-pr-url>
   EXPO_PUBLIC_SUPABASE_URL=<dev supabase url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<dev supabase anon>
   ```

4. `expo-github-action`'s `preview-comment` posts the install link/QR back
   to the PR.
5. On PR close, Railway tears down the env; the EAS build expires per
   project retention.

`eas.json` will need a `preview` profile, e.g.:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "",
        "EXPO_PUBLIC_SUPABASE_URL": "",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": ""
      }
    }
  }
}
```

(values overridden per build via `--env-file` produced by the GHA step).

## Required Secrets / GitHub Settings

To implement the recommendation we will need:

- `EXPO_TOKEN` — for `eas build` from CI.
- `RAILWAY_TOKEN` — for triggering API deploys and reading PR URLs.
- `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_JWT_AUD` —
  shared dev Supabase project credentials.
- `DATABASE_URL_DEV` (or Neon API token + project id, if we adopt Neon).
- `OPENAI_API_KEY_DEV` (optional; otherwise the API uses mock mode, which is
  perfectly acceptable for PR review).
- Optionally `FIREBASE_APP_DISTRIBUTION_*` (only if we add Option B as a
  fallback).

Per AGENTS.md and existing repo policy, none of these are committed; they
are added in repo Settings → Secrets and Variables.

## Cost Snapshot (order-of-magnitude)

Numbers below are rough public-tier figures and should be re-verified before
sign-off.

| Component                        | Free tier                       | Paid tier baseline           |
|---------------------------------|----------------------------------|------------------------------|
| EAS Build (preview profile)      | ~30 builds/mo                    | ~$99/mo (Production)         |
| EAS Update                       | Generous free                    | Bundled with paid plan       |
| Railway PR Environments          | Trial credits                    | ~$5–20/mo + usage            |
| Neon Postgres (branches)         | Generous free                    | ~$19/mo                      |
| Supabase Auth                    | Free for our user volume         | ~$25/mo if we outgrow it     |
| Firebase App Distribution        | Free                             | Free                         |

Expected MVP cost: dominated by EAS Build minutes and Railway. If PR volume
is low, free tiers may cover the whole pipeline.

## Risks And Open Questions

- **Native build cost**. Each PR with native changes triggers a full APK
  build. We may want a `paths-ignore` filter so docs/test-only PRs do not
  consume EAS minutes — fall back to Option C (EAS Update channel) for JS.
- **Android signing**. If we ever leave EAS, we must take ownership of the
  upload keystore — this is a one-way decision once a Play Store build
  exists.
- **Per-PR DB seeding**. Need a deterministic seed step so reviewers can log
  in without manually creating a Supabase user. Suggest a `npm run db:seed`
  in `apps/api` invoked after `prisma migrate deploy` in PR envs.
- **Privacy**. Per
  `docs/assistant-architecture-guardrails.md`, no real personal data should
  ever land on dev/preview infra. Seeded users only.
- **Teardown on stale PRs**. Railway and EAS both support this, but the
  workflows should explicitly delete environments on `pull_request: closed`.
- **Web preview value**. Worth re-evaluating once chat UI stabilizes; today
  native-only deps make it a poor signal.

## Recommended Pipeline (Summary)

1. Mobile: **EAS Build, `preview` profile, internal distribution**, with
   `EAS Update` channel-per-PR for JS-only follow-ups.
2. Backend: **Railway PR Environments**, parameterized via
   `RAILWAY_TOKEN`. Build runs `npm run build -w @personal-assistant/shared`
   then `nest build`.
3. Database: shared dev Postgres at first; switch to **Neon branches** when
   PR volume justifies it.
4. Auth: shared dev Supabase project for all PRs.
5. CI: GitHub Actions stitches the two together — Railway URL is captured
   and injected into the EAS build's `EXPO_PUBLIC_API_BASE_URL`. Both
   produce comments on the PR with install/visit links.

## Implementation Status

### Option A — implemented (mobile half)

- `apps/mobile/eas.json` defines `development`, `preview`, and `production`
  build profiles. The `preview` profile produces a signed Android APK with
  internal distribution, channel `preview`, and reads
  `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the build environment.
- `.github/workflows/preview-mobile.yml` runs on every PR (and via
  `workflow_dispatch` / `workflow_call`):
  1. Installs the workspace deps (`npm ci`) and builds
     `@personal-assistant/shared` so the mobile bundle resolves it.
  2. Sets up `eas-cli` via `expo/expo-github-action@v8` with `EXPO_TOKEN`.
  3. Resolves the API base URL — either from the `api_base_url` workflow
     input (intended to come from `preview-api.yml`, see below) or from
     the `EXPO_PUBLIC_API_BASE_URL_DEV` repo secret as a fallback.
  4. Invokes `eas build --profile preview --platform android
     --non-interactive --no-wait --json` and captures the build ID and
     details URL.
  5. Posts a sticky PR comment with the EAS build details link so a
     reviewer can install the APK once the queued build finishes.

### Required GitHub repository secrets for Option A

Add these in repo Settings → Secrets and Variables → Actions before the
workflow can succeed:

- `EXPO_TOKEN` — Expo personal access token with project access.
- `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY` — shared dev Supabase
  project credentials baked into the preview bundle.
- `EXPO_PUBLIC_API_BASE_URL_DEV` — fallback API base URL used until the
  `preview-api.yml` workflow is added; remove once API previews are wired
  in and pass `api_base_url` via `workflow_call`.

### Outstanding follow-ups (not in this change)

- TASK: Add `apps/api/Dockerfile` (or Railway nixpacks config) and a
  `railway.toml` so Railway builds the shared package before the API.
- TASK: Add `.github/workflows/preview-api.yml` and wire it so it emits
  the per-PR Railway URL as a workflow output, then call
  `preview-mobile.yml` via `workflow_call` with `api_base_url` so each
  APK is built against its matching backend.
- TASK: Decide DB strategy (shared vs Neon branches) and add the Prisma
  migrate + seed step into the API workflow.
- TASK: Document the reviewer flow (scan QR → install APK → log in with
  seeded test user) in `docs/`.
