# Product MVP

## MVP Goal

Ship a focused Android assistant that lets a user chat naturally, convert
messages into tasks/notes/reminders, receive reliable reminders, and use a paid
AI subscription without exposing OpenAI keys on the device.

## First Release Scope

- Account sign-in and subscription entitlement.
- Chat with OpenAI through the backend.
- Structured assistant actions for tasks, notes, reminders, and goals.
- Task list with status, priority, due date, and source tracking.
- Notes with assistant summaries.
- Reminder list and local notifications.
- Usage tracking, monthly quotas, and backend-enforced limits.
- Basic semantic memory in PostgreSQL with `pgvector`.
- Settings for privacy mode, data export/delete entry points, and billing.

## Explicit Non-Goals For MVP

- Fully offline AI.
- Multi-device conflict resolution for local-private data.
- Voice activation.
- Complex autonomous agents that change data without user visibility.
- Fine-grained calendar/email integrations.

## Subscription Assumptions

The MVP should start with simple tiers that are easy to enforce:

- Free: local tasks, notes, reminders, limited trial chat messages.
- Plus: monthly AI quota, cloud memory, proactive reminders, and better models.
- Pro: larger quota, deeper memory, more frequent goal checks, and priority
  processing.

Every OpenAI request must write usage records that include model, input tokens,
output tokens, estimated cost, feature, and user id. The backend rejects requests
when a user has no active entitlement or has exceeded quota.

## Assistant Behavior Rules

- Create proposed actions from chat before mutating important user data.
- Confirm destructive changes such as deleting notes or completing many tasks.
- Preserve the source message for each AI-created entity.
- Validate dates, priorities, and action payloads with shared schemas.
- Prefer concise, actionable reminders over generic motivational messages.

## Release Checklist

- Google Play Billing purchase flow and backend token verification.
- Privacy policy and Play Data Safety form.
- In-app account deletion and data deletion request path.
- Subscription cancellation link from settings.
- Crash reporting and backend error logging.
- Internal testing track with real devices and battery optimization checks.
- Staged rollout with usage and cost dashboards watched daily.
