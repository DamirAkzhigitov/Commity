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
7. [ ] Persist assistant-created tasks/notes/reminders securely in encrypted local SQLite
   on-device after user confirmation.
8. [ ] Add local notifications for user-created reminders.
9. [ ] Add durable usage tracking in Postgres and enforce subscription quotas.
10. [ ] (Deferred) Add Google Play Billing integration on mobile and real backend
    purchase verification.

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
  manual memory are stored on-device by default in encrypted SQLite. Advanced memory
  and summarization are deferred. Optional user-controlled backup/sync can use Google
  Drive or similar platform storage later. The backend should avoid storing personal
  assistant data unless needed for billing, auth, abuse prevention, or explicit
  user-enabled cloud features.
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

- First target user: ADHD / overwhelmed productivity users who need help turning
  messy thoughts into structured tasks, notes, reminders, and goals.
- Main promise: "A real personal assistant for everyday life: just talk naturally,
  and it helps you keep track of tasks, remember what matters, and make progress
  on your plans and goals."
- Automatic assistant actions: the assistant can automatically organize and draft
  low-risk things, including draft tasks, notes, reminder suggestions, goal plans,
  summaries, and next-step suggestions from natural language. All assistant-made
  actions must be reversible from the UI, like a lightweight history/rollback
  system, so user can easily undo mistakes.
- Always-confirm actions: anything with external impact or hard-to-undo
  consequences must require confirmation, including scheduling real reminders or
  notifications, deleting data, sharing/exporting data, changing privacy mode,
  sending anything to third-party services, making purchases, contacting other
  people, or creating/editing many items at once. Even when actions are
  reversible, the app should confirm anything that may interrupt the user later,
  expose private data, cost money, or affect someone else.
- First-release input: text-only for MVP, with the chat UI designed so voice
  input can be added later. Voice is valuable for overwhelmed users, but it adds
  permissions, transcription quality issues, cost, and UX complexity, so it
  should be an early post-MVP or paid-tier feature.
- First-release sync: no cross-device sync in MVP. Keep the first release
  single-device and local-first. Add optional encrypted backup/sync later,
  controlled by the user.
- AI data sharing and local-only mode: the app is AI-first. The main assistant
  experience uses AI to understand natural language, remember context, plan, and
  help proactively. Local-only mode exists as a privacy fallback for manual
  tasks, notes, reminders, goals, search, and manual memory, but it is not the
  full assistant experience. Users can mark individual items or sessions as
  private/local-only. Never send passwords, tokens, private keys, payment card
  numbers, or user-marked private data unless the user explicitly confirms.
  Extremely sensitive categories, such as health, finance, legal, intimate
  details, exact location, and third-party private information, should have
  stronger controls such as ask-first settings, redaction, or never-remember
  rules.
- Minimum useful free tier: a short, capped trial rather than an unlimited free
  plan. Free users get 25 assistant messages or 3 days, whichever comes first,
  with strict token/context limits, no voice, no proactive coaching, no advanced
  memory, and no cloud backup/sync. The free trial should still include enough AI
  usage to create tasks, notes, reminders, and a simple plan from natural
  language, so users feel the core assistant loop quickly while cost stays capped.
- Paid value drivers: users pay for ongoing assistant usefulness, not just more
  messages. Plus should include more AI messages, persistent memory, and
  proactive reminders/check-ins. Pro should include deeper goal coaching,
  stronger reasoning, higher limits, priority/best model access, and richer
  planning support. Better model quality matters, but should be presented through
  better outcomes rather than model names.
- Onboarding flow: keep onboarding short and honest. Explain that this is an
  AI-first personal assistant, so the main mode sends messages/context to AI to
  help understand, remember, plan, and remind. Flow: promise screen ("Your
  personal assistant for everyday life"), how it works ("Talk naturally. It turns
  thoughts into tasks, reminders, notes, and plans"), privacy choice (Assistant
  Mode vs Local-Only Mode), sensitive data controls (ask before using health,
  finance, legal, intimate, exact location, or other people's private info),
  control screen (view, edit, forget, export, or delete memory anytime), then a
  first real task prompt such as "What do you need help remembering today?"
  Default to Assistant Mode, but clearly explain it and give visible controls for
  private/local-only items.

## Suggested Build Order

1. Developer foundation: Git, Docker Compose, database migration, `.env` setup.
2. Backend foundation: auth, AI proxy, health checks, usage events, and entitlement checks.
3. Mobile foundation: navigation, API client, loading/error states, settings.
4. Core productivity: tasks, notes, reminders, and local notifications.
5. AI assistant: chat endpoint, structured action proposals, confirmations.
6. Monetization: subscription screen, Play Billing, backend entitlement checks.
7. Memory: summaries, embeddings, retrieval, context budgeting.
8. Proactive help: scheduled workers, push notifications, goal review rules.
9. Privacy and release: export/delete data, privacy copy, Play Data Safety, crash
   reporting, internal testing, staged rollout.
