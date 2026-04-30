# Apps Tech Stack Plan

## Direction

Keep the current Expo mobile app and NestJS API. The main change is architectural:
the mobile app should be the source of truth for personal assistant data, while
the API should handle AI calls, auth, billing, usage tracking, quotas, and
purchase verification.

## Keep

- `apps/mobile`: Expo React Native, TypeScript, and Expo Router.
- `apps/api`: NestJS and TypeScript.
- Backend-hosted OpenAI calls, so OpenAI keys never ship to the mobile app.
- PostgreSQL on the API side for infrastructure data.

## Mobile Changes

Add local-first infrastructure to `apps/mobile`:

- `expo-sqlite` for tasks, notes, reminders, goals, memory, chat history,
  privacy flags, and undo history.
- `expo-notifications` for local reminder scheduling in MVP.
- `expo-secure-store` for Supabase session/token data and sensitive local
  settings.
- An API client/state layer. Suggested: `@tanstack/react-query` for backend
  calls and optionally `zustand` for local UI/session state.
- An action history / rollback system. Every assistant-created change should be
  stored as a reversible operation so users can easily undo mistakes.
- Privacy mode UI for Assistant Mode, local-only/private items, and sensitive
  category controls.

Do not add voice input in MVP. Design the chat UI so voice can be added later.

## API Changes

Narrow the backend responsibility in `apps/api`:

- Add Supabase Auth JWT verification and replace demo `userId` values.
- Keep the OpenAI bridge, but make it return structured action proposals.
- Do not directly create personal tasks, notes, reminders, goals, or memory in
  backend Postgres for MVP.
- Persist usage events in Postgres instead of in memory.
- Enforce free, plus, and pro quotas before OpenAI calls.
- Keep billing and Google Play purchase verification on the backend.
- Add Sentry before internal testing, with message-content filtering disabled or
  scrubbed so personal assistant content is not collected.

## Prisma Direction

The current Prisma schema includes personal assistant data models such as tasks,
notes, reminders, goals, memory items, conversations, and chat messages.

For MVP, move those personal assistant records to mobile SQLite by default.
Backend Postgres should store only infrastructure data:

- users/auth mapping
- subscriptions
- purchase verification records
- usage events
- quota counters
- audit/security metadata
- non-sensitive operational logs

Defer `pgvector` and backend memory storage unless cloud memory or sync becomes
an explicit product decision.

## Deferred

- Voice input.
- Cross-device sync.
- Server-driven push reminders.
- Cloud memory and vector retrieval.
- Backend storage of personal assistant data.

## Target MVP Stack

- Mobile: Expo, TypeScript, Expo Router, SQLite, local notifications, secure
  storage, rollback history, and privacy controls.
- API: NestJS, Supabase Auth verification, OpenAI bridge, Postgres-backed usage
  tracking, quota enforcement, billing, and purchase verification.
