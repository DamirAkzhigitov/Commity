# TASK-002: Shared Assistant Action Contracts

## Outcome
Mobile and API use the same typed schemas for chat requests, local context packets, assistant responses, and action proposals.

## Type
Shared

## Implemented First Slice
- [x] Shared schemas define chat request, bounded context packet, assistant response, and assistant action proposal payloads.
- [x] Action proposal schemas cover create task (with optional nested subitems and task-scoped document references), create subitem, upsert document, schedule reminder (with optional task/subitem links), update item, delete item, and no-op/message-only responses.
- [x] Schemas distinguish low-risk draft proposals from actions requiring explicit confirmation.
- [x] Reminder payloads require validated title/text and schedule time; optional links use task/subitem local ids.
- [x] Context packet schemas include privacy filtering metadata so local-only/private items are excluded from backend AI payloads by default.
- [x] Context item kinds align with MVP hierarchy: `task`, `subitem`, `document`, `reminder`, `memory`, `chat_excerpt`.
- [x] Schema tests cover valid examples and invalid payloads for each action type.

## Required Contract Revision
- [x] Replace top-level note/goal proposal emphasis with Task, Subitem, Document, and Reminder payloads.
- [x] Context item kinds include `task`, `subitem`, `document`, `reminder`, `memory`, and `chat_excerpt`.
- [x] Task payloads can carry initial Subitems and task-scoped Document references.
- [x] Reminder payloads can link to a Task or Subitem local id.
- [x] Update shared schema tests and golden fixtures for Task/Subitem/Document examples.

## Implementation Notes
- Use Zod as the source of truth and export inferred TypeScript types.
- Keep payloads compatible with local SQLite ownership; do not assume backend-created personal records.
- Implemented in `packages/shared/src/assistant-contracts.ts` with Vitest tests in `assistant-contracts.test.ts`. API validates `POST /assistant/chat` with `assistantChatRequestSchema` and returns `proposals` per contract. Mobile applies proposals via `apply-assistant-proposal.ts` with local tables for tasks, subitems, documents, and reminders.
- Product-facing payload details mirror `docs/ai-context-contract.md`.

## Dependencies
- None.

## Verification
- `packages/shared` typecheck and schema tests pass.
