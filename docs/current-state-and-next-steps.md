# Current State And Next Steps

## Current State

The project is a greenfield monorepo for an Android-first AI personal assistant.
It currently has three main workspaces:

- `apps/mobile`: Expo React Native app using TypeScript and Expo Router.
- `apps/api`: NestJS backend using TypeScript, Prisma, PostgreSQL, and OpenAI.
- `packages/shared`: shared Zod schemas and TypeScript types used by mobile and API.

The mobile app has a starter home screen that communicates the product direction:
chat becomes structured tasks, notes, reminders, goals, and subscription-backed
assistant features. It is not connected to the backend yet.

The backend has initial modules for:

- `health`: basic API health check.
- `assistant`: OpenAI bridge skeleton with mock mode when `OPENAI_API_KEY` is not configured.
- `billing`: Google Play entitlement and purchase verification skeleton.
- `usage`: in-memory usage tracking skeleton for messages, tokens, and estimated cost.
- `prisma`: Prisma client service using PostgreSQL.

The shared package defines initial schemas for:

- tasks
- notes
- reminders
- goals
- memory items
- chat messages
- assistant actions
- subscription plans

Prisma has an initial data model for users, tasks, notes, reminders, goals,
memory items, conversations, chat messages, usage events, and subscriptions.
`pgvector` is represented with an unsupported vector field placeholder, but the
database extension and migrations still need to be finalized.

The workspace currently passes:

```bash
npm run typecheck
npm run build
```

## Immediate Next Steps

1. [ ] Initialize root Git and make the first scaffold commit.
2. [ ] Add a local development database setup, likely Docker Compose with PostgreSQL,
   Redis, and the `pgvector` extension.
3. [ ] Run the first Prisma migration and confirm the API can connect to Postgres.
4. [ ] Replace demo `userId` values with a real auth decision: Supabase Auth,
   Firebase Auth, or custom auth.
5. [ ] Connect the mobile app to the backend health endpoint and assistant chat endpoint.
6. [ ] Build the first real mobile screens: chat, task list, notes, reminders, and settings.
7. [ ] Persist assistant-created tasks/notes/reminders in the backend instead of only
   returning proposed actions.
8. [ ] Add local notifications for user-created reminders.
9. [ ] Add durable usage tracking in Postgres and enforce subscription quotas.
10. [ ] Add Google Play Billing integration on mobile and real backend purchase verification.

## Technical Questions To Answer

- Auth provider: Supabase Auth
- Backend hosting: Railway
- Database setup: local Docker Compose for backend development, Railway Postgres for
  MVP infrastructure data only: users, subscriptions, usage limits, purchase
  verification, audit/security metadata, and non-sensitive operational logs.
  Personal assistant data stays on-device by default.
- AI model policy: Free uses a capable low-cost model with strict message/token caps
  so first impressions stay strong; Plus uses the same model with higher quotas and
  limited upgrades for complex tasks; Pro can use the best available model for
  complex reasoning, planning, and memory-heavy tasks.
- Quotas: MVP placeholder to revisit in detail. Free trial gets 25 messages total
  or 3 days, whichever comes first, with strict token caps; Plus gets 1,000
  messages/month with moderate token caps; Pro gets 5,000 messages/month with
  higher token caps and priority access to better models.
- Memory strategy: local-first for MVP. Personal data, tasks, notes, reminders, and
  memory are stored on-device by default. Optional user-controlled backup/sync can
  use Google Drive or similar platform storage later. The backend should avoid
  storing personal assistant data unless needed for billing, auth, abuse prevention,
  or explicit user-enabled cloud features.
- Reminder strategy: local-only scheduled notifications for MVP. The backend/AI can
  create structured reminder candidates, but the mobile app schedules confirmed
  notifications on-device. Server-driven push reminders are deferred until proactive
  nudges, multi-device sync, or richer background scheduling are needed.
- Data deletion: immediate local data deletion from the app, plus immediate deletion
  or anonymization of backend infrastructure records where legally allowed. Purchase
  and audit records may be retained only as required for fraud prevention, billing,
  tax, or legal compliance.
- Analytics: only backend operational logs at first, with no personal message
  content. Add privacy-preserving product analytics later only after explicit
  consent and a clear privacy policy.
- Error monitoring: add Sentry before internal testing for API and mobile crashes,
  but disable collection of personal message content, breadcrumbs containing
  assistant text, and sensitive local data.

## Product Questions To Answer

- Who is the first target user: students, freelancers, professionals, ADHD users,
  founders, or general productivity users?
- What is the main promise of the app in one sentence?
- What should the assistant be allowed to do automatically without confirmation?
- Which actions must always require confirmation?
- Should the first release support voice input, or text-only?
- Should the app sync across devices in the first release?
- What personal data should never be sent to OpenAI unless the user explicitly confirms?
- What is the minimum useful free tier that does not create uncontrolled AI cost?
- What will make a user pay: more AI messages, memory, proactive reminders, better
  model quality, or goal coaching?
- What onboarding flow best explains privacy modes and AI data sharing?

## Suggested Build Order

1. Developer foundation: Git, Docker Compose, database migration, `.env` setup.
2. Backend foundation: auth, persisted user data, health checks, usage events.
3. Mobile foundation: navigation, API client, loading/error states, settings.
4. Core productivity: tasks, notes, reminders, and local notifications.
5. AI assistant: chat endpoint, structured action proposals, confirmations.
6. Monetization: subscription screen, Play Billing, backend entitlement checks.
7. Memory: summaries, embeddings, retrieval, context budgeting.
8. Proactive help: scheduled workers, push notifications, goal review rules.
9. Privacy and release: export/delete data, privacy copy, Play Data Safety, crash
   reporting, internal testing, staged rollout.
