# TASK-002: Shared Assistant Action Contracts

## Outcome
Mobile and API use the same typed schemas for chat requests, local context packets, assistant responses, and action proposals.

## Type
Shared

## Acceptance Criteria
- [x] Shared schemas define chat request, bounded context packet, assistant response, and assistant action proposal payloads.
- [x] Action proposal schemas cover create task, create note, create reminder, create goal, update item, delete item, and no-op/message-only responses.
- [x] Schemas distinguish low-risk draft proposals from actions requiring explicit confirmation.
- [x] Reminder payloads require validated title/text and schedule time.
- [x] Context packet schemas include privacy filtering metadata so local-only/private items are excluded from backend AI payloads by default.
- [x] Schema tests cover valid examples and invalid payloads for each action type.

## Implementation Notes
- Use Zod as the source of truth and export inferred TypeScript types.
- Keep payloads compatible with local SQLite ownership; do not assume backend-created personal records.
- Implemented in `packages/shared/src/assistant-contracts.ts` with Vitest tests in `assistant-contracts.test.ts`. API validates `POST /assistant/chat` with `assistantChatRequestSchema` and returns `proposals` per contract.

## Dependencies
- None.

## Verification
- `packages/shared` typecheck and schema tests pass.
