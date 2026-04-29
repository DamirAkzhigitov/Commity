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

## Git State Recommendation

Use one Git repository at the project root. If Expo created `apps/mobile/.git`,
remove that nested Git directory before the first root commit.

Recommended first checkpoint:

```bash
cd /home/xiao/Documents/Projects/PersonalAssistant
rm -rf apps/mobile/.git
git init
git add .
git commit -m "Initialize personal assistant MVP scaffold"
```

Commit after each working feature slice so the MVP can be reviewed and rolled
back safely.

## Immediate Next Steps

1. Initialize root Git and make the first scaffold commit.
2. Add a local development database setup, likely Docker Compose with PostgreSQL,
   Redis, and the `pgvector` extension.
3. Run the first Prisma migration and confirm the API can connect to Postgres.
4. Replace demo `userId` values with a real auth decision: Supabase Auth,
   Firebase Auth, or custom auth.
5. Connect the mobile app to the backend health endpoint and assistant chat endpoint.
6. Build the first real mobile screens: chat, task list, notes, reminders, and settings.
7. Persist assistant-created tasks/notes/reminders in the backend instead of only
   returning proposed actions.
8. Add local notifications for user-created reminders.
9. Add durable usage tracking in Postgres and enforce subscription quotas.
10. Add Google Play Billing integration on mobile and real backend purchase verification.

## Technical Questions To Answer

- Auth provider: should we use Supabase Auth, Firebase Auth, or custom auth?
- Backend hosting: where will the API and database run for MVP testing?
- Database setup: local Docker Compose only, managed Postgres, or both?
- AI model policy: which OpenAI models are allowed for Free, Plus, and Pro users?
- Quotas: how many messages and tokens should each subscription tier include?
- Memory strategy: should memory start cloud-only, or should local-private mode be
  part of the first public release?
- Reminder strategy: should proactive reminders be server-driven push notifications,
  local-only scheduled notifications, or a hybrid from the first MVP?
- Data deletion: should account deletion be immediate, delayed with recovery, or
  manual for the MVP?
- Analytics: should we use PostHog, Firebase Analytics, or only backend logs at first?
- Error monitoring: should Sentry be added before internal testing?

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
