# Milestone Acceptance Criteria: Assistant Context And Proposals

## Scope
This milestone validates the end-to-end loop for bounded AI context, schema-safe assistant responses, and user-confirmed local mutations.

## Acceptance Criteria
- Shared schemas define `chat request`, `context packet`, `assistant response`, and `proposals`.
- Mobile builds a bounded context packet from recent chat and relevant local Tasks, Subitems, Documents, and Reminders.
- Privacy filtering excludes local-only/private/sensitive items by default.
- API validates incoming request payload and outgoing response payload with shared schemas.
- API enforces auth, entitlement, and quota before provider calls.
- Assistant returns schema-valid proposals from natural-language chat input.
- Mobile renders assistant reply and proposal cards in chat flow.
- User can confirm, edit, dismiss, and undo proposals.
- Accepted proposals mutate local encrypted storage only.
- Task proposals can include Subitems and Documents as task-scoped context.
- Reminder proposals schedule local notifications only after user confirmation and remain tied to a Task or Subitem.
- API operational telemetry excludes personal content and full context payloads.
- Failure paths are safe: no mutation when validation/parsing/policy checks fail.

## Required Test Coverage

### Unit
- Shared schemas accept valid payloads and reject invalid payloads for each proposal type.
- Context budget calculations and caps are enforced.
- Privacy filters exclude restricted items.
- Task hierarchy helpers preserve Task/Subitem/Document relationships in local context.

### Integration
- `POST /assistant/chat` returns expected status and error codes for auth/policy/validation failures.
- Success path returns schema-valid `reply` + `proposals`.
- No personal content is written to durable logs or usage records.

### Contract
- Golden request/response fixtures validate against shared schemas in CI.

## Definition Of Done
- Criteria above implemented and passing in CI.
- API and mobile both consume the same shared contracts.
- Docs are updated and linked from the assistant documentation index.
