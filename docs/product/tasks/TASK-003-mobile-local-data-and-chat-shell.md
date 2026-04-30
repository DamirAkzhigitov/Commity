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
