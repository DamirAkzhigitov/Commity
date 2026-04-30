# REQ-001: MVP Development Sequence

## User Story
As an early user, I want to chat with the assistant and safely turn messages into local tasks, notes, reminders, and goals, so that the app becomes useful before broader features are added.

## Scope
- In:
  - Text-only assistant chat.
  - Local-first storage for personal assistant data on Android.
  - Backend AI proxy, auth verification, usage tracking, quota enforcement, and billing entitlement checks.
  - Structured action proposals that require user confirmation before creating reminders, deleting data, sharing data, changing privacy settings, purchasing, or mutating many items.
  - Local scheduled notifications for confirmed reminders.
- Out:
  - Voice input.
  - Cloud sync or server-stored personal memory.
  - Server-driven push reminders.
  - Offline AI.
  - Complex autonomous agents.

## Acceptance Criteria
- [ ] Given a signed-in user with available quota, when they send a chat message, then the backend calls AI without exposing provider keys to the app.
- [ ] Given an assistant response that identifies a task, note, reminder, or goal, when the response returns to the app, then the app shows a structured proposal before changing local data.
- [ ] Given a user confirms a proposed task, note, reminder, or goal, when the app saves it, then it is persisted locally with source message metadata and can be edited or undone.
- [ ] Given a user confirms a reminder with a valid time, when it is saved, then the app schedules a local notification on the device.
- [ ] Given a user has no entitlement or has exceeded quota, when they send an AI request, then the backend rejects the request before calling AI.
- [ ] Given personal assistant data is stored, when the backend database is inspected, then tasks, notes, reminders, goals, memory, and chat history are not stored there by default.

## Implementation Notes
- Backend: prioritize auth, AI proxy, usage events, quota checks, entitlement checks, and non-sensitive operational data.
- Supabase DB creation defaults: Data API OFF, Automatically expose new tables/functions OFF, Automatic RLS ON.
- Frontend: prioritize local SQLite models, chat UI, action confirmation UI, reminder scheduling, and settings entry points.
- Shared: define schemas for chat requests, bounded context packets, assistant responses, action proposals, and local entity payloads.
- Privacy/billing/release: avoid personal message content in usage logs; add clear AI data sharing copy before internal testing.

## Open Questions
- Final auth provider is assumed to be Supabase Auth.
- Initial free trial quota is assumed to be 25 assistant messages or 3 days, whichever comes first.
- Exact Plus and Pro quota values need confirmation before billing implementation.
