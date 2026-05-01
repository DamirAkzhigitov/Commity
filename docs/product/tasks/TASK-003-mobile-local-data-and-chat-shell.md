# TASK-003: Mobile Local Data And Chat Shell

## Outcome
The Android app has the first usable shell for local assistant data, text chat, and action proposal review.

## Type
Frontend

## Acceptance Criteria
- [ ] App navigation includes chat, tasks, notes, reminders, goals, and settings entry points.
- [ ] App includes mobile auth screens and secure session handling for signed-in assistant usage.
- [ ] Local SQLite tables exist for tasks, notes, reminders, goals, chat messages, source metadata, privacy flags, and action history.
- [ ] Local SQLite data is encrypted at rest for personal assistant content.
- [ ] The chat screen can send a message to the backend and render assistant text plus structured proposals.
- [ ] The user can accept, edit, dismiss, or undo assistant-created local items.
- [ ] Saved local items include source message metadata.
- [ ] Local-only/private item flags prevent those items from being included in AI context by default.
- [ ] Context packets sent to the backend apply privacy filtering for local-only/private and sensitive categories by default.

## Implementation Notes
- Start with deterministic local storage and simple lists before polishing UI.
- Add the API client and auth session handling early so chat can be tested end to end.
- Keep voice UI out of scope, but avoid layouts that block adding it later.

## Dependencies
- `TASK-001-backend-foundation-auth-ai-usage.md`
- `TASK-002-shared-assistant-action-contracts.md`

## Verification
- Manual Android flow: sign in, send chat, accept a proposed task, view it in the task list, undo it.

## Slice 2 (done): navigation shell + encrypted SQLite + proposals + privacy context
- **Tabs**: `(tabs)` layout with Chat, Tasks, Notes, Reminders, Goals, Settings (`app/(tabs)/`).
- **SQLite**: `lib/local-db.ts` creates encrypted-at-rest assistant tables (`*_cipher` columns via `lib/local-content-crypto.ts`), plus `chat_messages`, `item_source_meta`, `action_history`.
- **Chat**: persists encrypted chat rows; sends optional `context` built by `lib/context-packet.ts` + `lib/chat-context-loader.ts` (filters `local_only` by default; Settings toggle persists broader packet consent via `lib/context-consent-storage.ts`).
- **Proposals**: `lib/apply-assistant-proposal.ts`, draft merge `lib/merge-proposal-draft.ts`, Accept / Edit / Dismiss / Undo last create on Chat screen.
- **Vitest**: `lib/context-packet.test.ts` asserts privacy filtering + shared schema validity.
- **Next slice**: polish UX (navigation guards), richer undo stacks, backend honoring `includeInAi`, confirmed-reminder scheduling (TASK-004).

## Slice 1 (done): auth + typed chat client + minimal UI
- **Mobile**: `AuthProvider` / `useAuth` with **auth-only** Supabase JS (`lib/supabase-auth.ts`: `Pick<SupabaseClient,'auth'>`); session persisted with **DEK in `expo-secure-store`** and ciphertext in AsyncStorage (`lib/supabase-auth-secure-storage.ts`). `/sign-in` and `/chat` (POST `/assistant/chat` with `getAccessTokenForApi()` for refreshed JWTs). Config via `EXPO_PUBLIC_*` (`apps/mobile/.env.example`, root `.env.example`). Vitest: `lib/assistant-chat-wiring.test.ts`, **`lib/supabase-import-boundary.test.ts`** (blocks accidental `@supabase/supabase-js` data client usage outside `lib/supabase-auth.ts`).
- **API JWT**: `SupabaseJwtVerifierService` accepts **RS256 and ES256** access tokens from current Supabase signing keys.
- **401 note**: If mobile signs in but chat returns 401, verify **same `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`** and that API `SUPABASE_URL`/`SUPABASE_JWT_AUD` match the issuing project.
