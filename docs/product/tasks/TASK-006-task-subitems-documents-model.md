# TASK-006: Task Subitems And Documents Model

## Outcome
Tasks become outcome-oriented local records with many Subitems, task-scoped Documents, and assistant context support.

## Type
Frontend | Shared

## Acceptance Criteria
- [ ] Local SQLite stores Tasks, Subitems, Documents, and their relationships with encrypted personal text fields.
- [ ] The Tasks tab lists outcome-oriented Tasks and opens a Task detail view.
- [ ] A Task detail view shows Subitems, Documents, linked Reminders, source metadata, privacy flags, and status.
- [ ] Users can create, edit, complete, and undo Tasks and Subitems.
- [ ] Users can add, edit, remove, and mark Documents private/local-only.
- [ ] PA proposals can create or update Tasks, Subitems, Documents, and linked Reminders after user confirmation.
- [ ] Local context packets can include relevant Task hierarchy data while excluding private/local-only Documents by default.

## Implementation Notes
- Keep Documents simple for MVP: title, type, URI or local reference, optional short extracted snippet, privacy flag, and source metadata.
- Do not upload files to the backend. If a Document snippet is sent to AI, it must pass the same local privacy filtering and context budget rules as other context items.
- Model Subitems as ordered child records under a Task with status and completion metadata.
- Treat Reminders as scheduled prompts linked to a Task or Subitem, not as independent todos.

## Dependencies
- `TASK-002-shared-assistant-action-contracts.md`
- `TASK-003-mobile-local-data-and-chat-shell.md`

## Verification
- Manual Android flow: create a Task, add Subitems and a Document, schedule a linked Reminder, mark one Document private, and confirm the private Document is excluded from AI context.
- Automated tests cover local hierarchy persistence, proposal application, privacy filtering, and context packet validation.
