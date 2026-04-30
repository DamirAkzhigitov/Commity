# EPIC-001: Usable MVP Core Loop

## Goal
Move from empty modules to a usable, testable Android-first core loop: secure sign in, chat, receive structured action proposals, save confirmed items locally in encrypted storage, schedule local reminders, and enforce backend AI usage limits.

## Why Now
This proves the product promise with the smallest useful release slice while protecting local-first privacy, AI cost control, and reminder reliability. It is the usable core loop foundation, not the full MVP release.

## Included Requirements
- `REQ-001-mvp-development-sequence.md`

## Tasks
- `TASK-002-shared-assistant-action-contracts.md`
- `TASK-001-backend-foundation-auth-ai-usage.md`
- `TASK-003-mobile-local-data-and-chat-shell.md`
- `TASK-004-mobile-confirmed-reminders.md`

## Done When
- [ ] A developer can run the mobile app and API locally from documented commands.
- [ ] A signed-in user can send a text message to the assistant through the backend.
- [ ] The backend verifies entitlement and quota before making an AI request.
- [ ] The assistant returns structured action proposals using shared schemas.
- [ ] The app can confirm and save tasks, notes, reminders, and goals locally.
- [ ] Confirmed reminders schedule local notifications.
- [ ] Backend usage records exclude personal message content.

## Out Of Scope
- Google Play purchase flow and real billing integrations (deferred to a later billing epic).
- Advanced memory, local summarization, and vector embeddings (deferred).
- Server-stored personal memory or cross-device cloud sync.
- Server-driven push reminders.
- Voice input and transcription.
- Offline AI models or autonomous background agents.

## Risks
- Android local notification reliability must be tested on real devices.
- AI cost can grow quickly without quota enforcement before broad testing.
- Storing personal assistant data in backend Postgres would conflict with the MVP privacy model.
