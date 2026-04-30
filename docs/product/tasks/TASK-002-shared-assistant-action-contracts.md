# TASK-002: Shared Assistant Action Contracts

## Outcome
Mobile and API use the same typed schemas for chat requests, local context packets, assistant responses, and action proposals.

## Type
Shared

## Acceptance Criteria
- [ ] Shared schemas define chat request, bounded context packet, assistant response, and assistant action proposal payloads.
- [ ] Action proposal schemas cover create task, create note, create reminder, create goal, update item, delete item, and no-op/message-only responses.
- [ ] Schemas distinguish low-risk draft proposals from actions requiring explicit confirmation.
- [ ] Reminder payloads require validated title/text and schedule time.
- [ ] Context packet schemas include privacy filtering metadata so local-only/private items are excluded from backend AI payloads by default.
- [ ] Schema tests cover valid examples and invalid payloads for each action type.

## Implementation Notes
- Use Zod as the source of truth and export inferred TypeScript types.
- Keep payloads compatible with local SQLite ownership; do not assume backend-created personal records.

## Dependencies
- None.

## Verification
- `packages/shared` typecheck and schema tests pass.
