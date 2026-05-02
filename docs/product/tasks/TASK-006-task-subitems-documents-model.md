# TASK-006: Task Subitems And Documents Model

## Outcome
Tasks become outcome-oriented local records with many Subitems, task-scoped Documents, and assistant context support.

## Type
Frontend | Shared

## Acceptance Criteria
- [x] Local SQLite stores Tasks, Subitems, Documents, and their relationships with encrypted personal text fields.
- [x] The Tasks tab lists outcome-oriented Tasks and opens a Task detail view.
- [x] A Task detail view shows Subitems, Documents, linked Reminders, source metadata, privacy flags, and status.
- [x] Users can create, edit, complete, and undo Tasks and Subitems.
- [x] Users can add, edit, remove, and mark Documents private/local-only.
- [x] PA proposals can create or update Tasks, Subitems, Documents, and linked Reminders after user confirmation.
- [x] Local context packets can include relevant Task hierarchy data while excluding private/local-only Documents by default.

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

## Implementation Record (2026-05-02)
- **Mobile data layer (`apps/mobile/lib/local-db.ts`):** added `getTaskByIdDecrypted`, `listSubitemsByTaskDecrypted`, `listDocumentsByTaskDecrypted`, `listRemindersLinkedToTaskDecrypted`, `getItemSourceMeta`, `setTaskStatus`, `setSubitemStatus`, and manual create wrappers (`createTaskManual`, `createSubitemManual`, `createDocumentManual`) that record `action_history` so the existing `undoLastAppliedCreate` flow covers manual creates as well as assistant proposals. `setEntityLocalOnly` now accepts `subitem` and `document` so per-entity privacy can be toggled.
- **Mobile UI:**
  - New stack route `app/task/[id].tsx` shows the Task detail view (subitems, documents, linked reminders), its source metadata pill (manual vs assistant proposal), privacy switch, status, plus inline edit/complete/delete and add-subitem/add-document forms with a per-document private toggle.
  - New stack route `app/task/new.tsx` is the manual task creator (title, description, priority pills, inline subitems, optional initial document with privacy toggle).
  - Tasks tab (`app/(tabs)/tasks.tsx`) is now an outcome-oriented list with subitem/document/reminder counts (highlighting private docs), tap-to-open detail view, a "New task" CTA, and a single "Undo last create" affordance backed by `undoLastAppliedCreate`.
- **Privacy filter:** `loadLocalContextRows` already passes per-row `localOnly` for documents/subitems; `buildAssistantContextPacketFromRows` continues to drop local-only docs unless the user opted into broader context (where they are sent with `includeInAi: false`). New unit test asserts the Task hierarchy is preserved while a private Document is excluded by default.
- **Tests:** vitest covers the new helpers via an in-memory SQL fake (`lib/local-db-task-helpers.test.ts`) plus an extended `context-packet.test.ts` case for hierarchical privacy filtering. `npm run typecheck` and the api/shared/mobile test suites all pass.
