# Per-PR Reviewer Flow

This is the operator-facing reference for **reviewing a PR using the
per-PR dev builds**. It complements `docs/per-pr-dev-builds.md`, which
covers the design decisions and CI plumbing.

## What you get on every PR

When a PR is opened (and not in draft), two GitHub Action workflows run:

1. **`preview-api`** — builds `apps/api` with the Dockerfile, deploys
   it to a per-PR Railway environment named `pr-<number>`, applies
   Prisma migrations, runs the deterministic dev seed, and posts a PR
   comment titled **"API preview"** with the public URL.
2. **`preview-mobile`** — runs an EAS Build (`preview` profile, Android
   APK) with `EXPO_PUBLIC_API_BASE_URL` baked in to point at the
   `preview-api` URL above. Posts a PR comment titled **"Mobile preview
   build (Android APK)"** with the EAS build details URL.

Reviewer time-to-test is roughly: API deploy (~1–3 min) + EAS queue +
APK build (~8–12 min on free tier).

## Prerequisites for reviewers

- Android device or emulator.
- Allow installation from unknown sources (Settings → Apps & notifications
  → Special access → Install unknown apps).
- A user account in the shared dev Supabase project. The seed script
  creates the `User` row keyed to UUID
  `00000000-0000-4000-8000-000000000001`. To match it, create a Supabase
  user with that exact UUID (or set `DEV_SEED_USER_ID` to whatever UUID
  your seeded Supabase user actually has — easier).

## Step-by-step

1. Open the PR. Wait for the two preview comments to appear (the
   workflows are gated on `paths` filters — docs-only PRs won't rebuild).
2. **Verify the API.** Click the URL in the **API preview** comment and
   load `<url>/health` in a browser. Expected response:
   ```json
   { "status": "ok", "service": "personal-assistant-api", "timestamp": "..." }
   ```
3. **Install the APK.** Open the **Mobile preview build** comment's
   "Build details" URL on your Android device. Tap **Install** on the
   EAS build page. If the build is still queued/running, refresh; you
   can also scan the QR code from desktop using your device camera.
4. **Launch the app.** Sign in with your dev Supabase user. The bundled
   `EXPO_PUBLIC_API_BASE_URL` already points at the per-PR API, so the
   first call to `/assistant/chat` will exercise the new backend code.
5. **Run through the change under review.** Most assistant PRs have an
   acceptance-criteria checklist in
   `docs/milestone-assistant-context-acceptance.md` or in the linked
   task doc — use that.
6. **When done**, close or merge the PR. Closing fires the teardown job
   in `preview-api.yml` which deletes the Railway environment. EAS
   builds expire per project retention.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Install page on EAS shows "Build expired" | EAS retention exceeded for free tier | Push an empty commit to retrigger; mobile workflow rebuilds. |
| App opens but every request 401s | Supabase user UUID does not match seed | Either set `DEV_SEED_USER_ID` repo secret to the Supabase user's UUID, or recreate the Supabase user with the seed UUID. |
| `/health` returns 502 / no response | Railway PR env still warming, or DB migration failed | Check the `preview-api` job logs in the PR's "Checks" tab. |
| Mobile workflow reports "No API base URL provided" | `EXPO_PUBLIC_API_BASE_URL_DEV` secret missing AND PR didn't touch API/shared so `preview-api` didn't run | Re-trigger via Actions → preview-mobile → "Run workflow" with an explicit `api_base_url`, or add the fallback secret. |
| APK installs but home screen shows network error | API URL not reachable from device | Confirm the URL works from a desktop browser; if so, your device firewall/captive portal is blocking it. |

## Privacy reminder

Per `docs/assistant-architecture-guardrails.md`, **no real personal
data ever lands on dev/preview infra**. Use the seeded reviewer user
only. If you create test data, keep it synthetic.

## See also

- `docs/per-pr-dev-builds.md` — design rationale and option comparison.
- `docs/SUPABASE_SETUP.md` — Supabase dashboard / Auth-only configuration.
- `apps/api/prisma/seed.ts` — what the seed creates.
