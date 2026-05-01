# TASK-008: Assistant Quality Grounding

## Outcome
The assistant's replies and proposals are grounded in the local context the mobile app sent, avoid duplicating items the user already has, prefer updating over recreating, and surface uncertainty when context is incomplete.

## Type
Backend | Shared

## Problem Statement
After TASK-005 the API forwards `context.items` into the model prompt, but there is no system-prompt scaffolding that:
1. Forces the model to consult `context.items` before proposing new Tasks/Subitems/Documents/Reminders.
2. Maps "this looks like an existing item" into an `update_item` proposal instead of `create_task` / `create_subitem` / `upsert_document` / `schedule_reminder`.
3. Tells the model to express uncertainty (and to ask for missing context) instead of confidently inventing details.

This is the second-biggest assistant-quality lever after good context selection.

## User / Business Impact
A grounded assistant feels personal and useful; an ungrounded one creates duplicate Tasks and Reminders, ignores the user's existing Subitems and Documents, and erodes trust quickly. The cost of ungrounded behavior compounds because every duplicate proposal also burns paid AI tokens.

## Scope

### In
- A revised system prompt for the assistant chat path that instructs the model to:
  - Ground responses in `Local Context` items with `includeInAi: true`.
  - Prefer `update_item` over re-creation when an item with the same `kind` already exists.
  - Reuse existing `localId`s in `update_item` / `delete_item` payloads instead of inventing new ones.
  - Express uncertainty in `reply` when the local context is incomplete (e.g., "I don't see a passport Task yet — do you want me to create one?").
- Backend post-validation that drops or rewrites proposals violating the above rules (e.g., a `create_task` whose title duplicates an existing context Task ⇒ rewritten to `update_item` or dropped with a logged reason; an `update_item` whose `localId` is not in `context.items` ⇒ dropped).
- Unit tests against a deterministic mock model that the prompt + post-filter together produce grounded proposals on a small fixture set.
- A short documentation note in `docs/ai-context-contract.md` describing the grounding/duplicate rules so mobile, API, and shared schemas stay aligned.

### Out
- New shared-schema fields.
- Embeddings or semantic similarity. Duplicate detection is normalized-string equality plus simple containment.
- Changes to the proposal types themselves.
- Streaming, tools/function-calling, or multi-turn planner state.

## Acceptance Criteria
- [ ] System prompt explicitly references the Local Context block and the rule "prefer update over create when an existing item matches".
- [ ] Post-validation in `apps/api/src/assistant` rewrites or drops proposals that:
  - duplicate an existing context Task/Subitem/Document/Reminder by normalized title, or
  - reference a `localId` that is not in `context.items` for `update_item` / `delete_item`.
- [ ] Dropped/rewritten proposals are recorded in operational logs without personal content (only proposal type, reason code, and `clientRequestId`).
- [ ] Reply text mentions uncertainty when the model would otherwise invent missing context (covered by prompt + at least one fixture test).
- [ ] Jest unit tests cover three scenarios: (a) duplicate `create_task` becomes `update_item`, (b) `update_item` with unknown `localId` is dropped, (c) absent context yields a "do you want me to create…" reply, no silent create.
- [ ] No personal message content or context content is written to long-lived logs; reason codes only.

## Technical Investigation Notes
- `apps/api/src/assistant/assistant.service.ts` constructs OpenAI input via `assistant-context-input.ts`. The system prompt is the natural place to add grounding rules.
- `planActions` currently runs message-only and produces structured proposals. It needs awareness of the (already-validated) `context.items` to compare against and to reuse `localId`s.
- `packages/shared/src/assistant-contracts.ts` already exposes `update_item` and `delete_item` with `localId` + `kind`, so no schema change is required.
- Operational logging already excludes message bodies; reuse that path with new reason codes.

## Implementation Notes
1. Add `apps/api/src/assistant/grounding-rules.ts` with:
   - `buildSystemPrompt(contextItems)` that emits the grounding rules and a short bulleted local-context recap.
   - `enforceGroundingRules(proposals, contextItems)` that rewrites/drops invalid proposals and returns `{ proposals, dropped: Array<{ proposalId, reasonCode }> }`.
2. Wire `buildSystemPrompt` into the existing prompt builder; thread `contextItems` from `request.context.items.filter(i => i.includeInAi !== false)`.
3. Wire `enforceGroundingRules` between `planActions` and the response so the API contract output respects the rules.
4. Reason codes (stable strings): `DUPLICATE_OF_CONTEXT_ITEM`, `UNKNOWN_LOCAL_ID`, `MISSING_REQUIRED_LINK`.
5. Add Jest unit tests with a mocked OpenAI client; assert grounded outputs and dropped-reason logging.

## Dependencies
- `TASK-005-restore-chat-history-and-api-context.md`
- `TASK-007-mobile-local-context-retrieval.md`

## Verification

### Manual
- With a local Task titled "Renew passport", send "make a task to renew my passport". Confirm the API returns an `update_item` (or `noop` + reply pointing at the existing Task) instead of a new `create_task`.
- Without any local context, send "remind me about the dentist". Confirm the reply asks whether to create the Task/Reminder rather than silently producing one.

### Automated
- Jest: duplicate-create gets rewritten to `update_item`.
- Jest: `update_item` with unknown `localId` is dropped and logged with `UNKNOWN_LOCAL_ID`.
- Jest: missing context yields a reply that contains an explicit confirmation question and no creates.
- Existing API e2e remains green.

## Risks / Dependencies
- Normalized-string duplicate detection will miss paraphrased duplicates. Document this as expected MVP behavior and revisit after evaluation fixtures land in TASK-009.
- System prompt changes can regress mock-mode replies; keep mock fixtures stable and test both `mock` and stubbed-OpenAI paths.
- Avoid logging the prompt itself; only log proposal reason codes.

## Definition Of Done
- System prompt includes grounding rules referencing local context.
- Post-validation enforces those rules and emits stable reason codes for drops.
- Unit tests cover the three core scenarios.
- `docs/ai-context-contract.md` reflects the new rules without changing field-level schemas.
- No new personal-content persistence path is introduced.
