# Product MVP

## MVP Goal

Ship a focused Android assistant that lets a user chat naturally, convert
messages into tasks/notes/reminders, receive reliable reminders, and use a paid
AI subscription without exposing OpenAI keys on the device or storing personal
assistant data on the backend by default.

## First Release Scope

- Account sign-in and subscription entitlement.
- Chat with OpenAI through the backend, using a small local context packet built
  on the device.
- Structured assistant actions for tasks, notes, reminders, and goals.
- Task list with status, priority, due date, and source tracking.
- Notes with assistant summaries.
- Reminder list and local scheduled notifications.
- Local-first storage for tasks, notes, reminders, goals, memory, and chat
  history.
- Local context retrieval using SQLite search, summaries, recency, importance,
  due dates, and completion state.
- Usage tracking, monthly quotas, and backend-enforced limits.
- Settings for data export/delete entry points, AI data sharing explanation, and
  billing.

## Explicit Non-Goals For MVP

- Fully offline AI.
- Multi-device conflict resolution for local-private data.
- Cloud sync or cloud memory as a default behavior.
- Local vector database and on-device embedding model.
- Voice activation.
- Complex autonomous agents that change data without user visibility.
- Fine-grained calendar/email integrations.
- Server-driven proactive reminders and push notifications.

## Subscription Assumptions

The MVP should start with simple tiers that are easy to enforce:

- Free: local tasks, notes, reminders, limited trial chat messages.
- Plus: monthly AI quota, higher local-context limits, and better model access
  for complex tasks.
- Pro: larger quota, deeper local context windows, more advanced reasoning, and
  priority access to better models.

Every OpenAI request must write non-sensitive usage records that include model,
input tokens, output tokens, estimated cost, feature, and user id. The backend
rejects requests when a user has no active entitlement or has exceeded quota.
Usage records should not store personal message content.

## Assistant Behavior Rules

- Create proposed actions from chat before mutating important user data.
- Confirm destructive changes such as deleting notes or completing many tasks.
- Preserve the source message for each AI-created entity.
- Validate dates, priorities, and action payloads with shared schemas.
- Prefer concise, actionable reminders over generic motivational messages.
- Build assistant context locally from relevant tasks, notes, reminders, goals,
  memory summaries, and recent chat before calling the backend.
- Ask for confirmation before sending unusually sensitive or broad personal
  context to AI.

## Release Checklist

- Google Play Billing purchase flow and backend token verification.
- Privacy policy and Play Data Safety form.
- In-app local data deletion and backend account deletion/anonymization path.
- Subscription cancellation link from settings.
- Crash reporting and backend error logging.
- Internal testing track with real devices and battery optimization checks.
- Staged rollout with usage and cost dashboards watched daily.
