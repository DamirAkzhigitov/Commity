# TASK-007: Mobile Local Context Retrieval

## Outcome
The mobile app builds a bounded, privacy-filtered local context packet on every assistant request, prioritizing the items most likely to make the assistant's reply useful (recent and relevant Tasks, Subitems, Documents, Reminders, memory summaries, and recent chat).

## Type
Frontend | Shared

## Problem Statement
Today the chat shell sends a minimal context packet from `loadLocalContextRows` ordered by `updated_at` and capped at 48 items. There is no ranking by recency vs. due dates vs. status, no scoring against the user's current message, no token/character budgeting against the shared `context.budget.maxTotalChars` limit, and no second-line privacy gate beyond the `local_only` flag. Bad context selection is the main blocker for assistant quality (EPIC-002).

## User / Business Impact
Without ranked, bounded context, the assistant either over-sends (cost + privacy risk) or under-sends (generic replies, duplicate proposals). Both weaken the MVP value promise and waste paid AI tokens.

## Scope

### In
- A deterministic, testable local context selection step that runs before every assistant chat request.
- Ranking signals from existing local SQLite fields: recency (`updated_at`), due dates (`due_at`, `remind_at`), completion status, priority, simple text overlap with the outgoing user message, and source links between Tasks/Subitems/Documents/Reminders.
- A character-budget enforcer that respects `context.budget.maxTotalChars` from the shared schema and trims fields (snippet first, then optional metadata) before dropping items.
- A second-pass privacy filter on top of `local_only` for sensitive-category metadata (health, finance, legal, intimate, exact location, third-party private info) that defaults to exclusion unless `privacy.userConfirmedBroaderContext` is true.
- A user-visible confirmation prompt when a request would otherwise include a sensitive-category item or a broad packet (e.g., > N tasks/documents).
- Vitest coverage for ranking, budgeting, redaction, and packet validity against the shared Zod schema.

### Out
- New context kinds beyond what the shared schema already accepts (`task | subitem | document | reminder | memory | chat_excerpt`).
- On-device embeddings, vector search, or local LLM summarization.
- Cloud sync, push, or server-evaluated context.
- Re-ranking based on assistant feedback signals (deferred to a later quality loop).

## Acceptance Criteria
- [ ] Mobile builds a context packet through a single named entry point (e.g., `selectAssistantContext(message, localRows, options)`) that returns a packet validated by `assistantChatRequestSchema` before send.
- [ ] Ranking uses deterministic SQLite fields plus a simple text overlap score against the outgoing user message; ties break by recency.
- [ ] Items with `local_only = true` are excluded by default and only included when `privacy.userConfirmedBroaderContext === true`.
- [ ] Items tagged as sensitive-category are excluded by default; including them requires explicit user confirmation in that turn.
- [ ] The selected packet's serialized character size is `<= budget.maxTotalChars`; oversized snippets are trimmed and oversized item lists drop lowest-ranked items, never silently exceeding the budget.
- [ ] If the candidate packet would be unusually broad (default threshold: more than 20 included items, > 25% sensitive-flagged, or > 80% of `maxTotalChars` consumed), the chat send flow prompts the user once per turn before sending.
- [ ] Vitest unit tests cover: ranking determinism, budget trimming order, sensitive-category exclusion, broad-context confirmation gating, and final shared-schema validity.
- [ ] No personal content leaves `selectAssistantContext` for a network or log path other than the `POST /assistant/chat` body.

## Technical Investigation Notes
- `apps/mobile/lib/local-db.ts` already exposes `loadLocalContextRows` returning a `LocalContextRow[]` with `kind`, `localId`, `title`, optional `bodySnippet`, `localOnly`, and metadata.
- `apps/mobile/lib/context-packet.ts` already builds a privacy-filtered packet and a Vitest exists for shape conformance.
- `apps/mobile/lib/chat-context-loader.ts` is the current call site and the right place to wire in the new selector.
- `packages/shared/src/assistant-contracts.ts` is the schema source of truth for `context`, `budget`, `privacy`, and item shape.
- Settings already persists broader-context consent via `lib/context-consent-storage.ts`; reuse it for the per-turn confirmation default.

## Implementation Notes
1. Introduce `apps/mobile/lib/select-assistant-context.ts` exporting a pure ranking + budgeting function that takes `(message, rows, opts)` and returns the validated packet plus an "explanation" record (what was kept, what was dropped, total chars). Keep it pure for tests.
2. Score formula (MVP): `0.4 * recencyScore + 0.25 * dueScore + 0.15 * priorityScore + 0.15 * messageOverlapScore + 0.05 * statusScore`. Document the formula inline; tune via unit fixtures, not magic numbers in screen code.
3. Trim order when over-budget: drop optional `bodySnippet` chars beyond ~280 → drop `metadata` keys beyond top 4 → drop lowest-scored items. Never break shared schema constraints.
4. Sensitive-category gate: extend `LocalContextRow` (or its source rows) with an optional `sensitiveCategory` flag derived from existing `metadata` (e.g., `documentType` ∈ `{health, finance, legal, intimate, location}`). Default-exclude; require turn-level confirmation to include.
5. Wire the selector into `chat-context-loader.ts` and `(tabs)/chat.tsx` send flow with a single confirmation modal/inline prompt for "broad" or "sensitive" outgoing context. Keep voice/UI minimal; the prompt is text-only.
6. Add `selectAssistantContext` Vitest cases plus an integration test that runs `assistantChatRequestSchema.safeParse` on the produced packet.

## Dependencies
- `TASK-002-shared-assistant-action-contracts.md`
- `TASK-003-mobile-local-data-and-chat-shell.md`
- `TASK-005-restore-chat-history-and-api-context.md`
- `TASK-006-task-subitems-documents-model.md`

## Verification

### Manual (Android)
- Send a message related to an existing Task; observe that the relevant Task, its Subitems, and one linked Document appear in the outgoing packet (debug log only, no plaintext logging).
- Mark a Document as local-only; confirm the next send omits it.
- Mark a Document with `documentType=health` and confirm send is blocked behind a one-tap "Include sensitive item this turn?" prompt.
- Force a small `maxTotalChars` to confirm trimming order matches the spec.

### Automated
- Vitest: ranking determinism (same inputs ⇒ same packet).
- Vitest: trimming respects the documented order until under budget.
- Vitest: `local_only` and sensitive-category exclusion are default-on.
- Vitest: broad-context threshold triggers the confirmation flag.
- Vitest: produced packet passes `assistantChatRequestSchema.safeParse`.

## Risks / Dependencies
- Ranking quality is approximate without embeddings. Keep the formula simple and test-driven; defer embeddings until after MVP evidence.
- Sensitive-category detection is metadata-only; we will not infer sensitivity from free text in MVP.
- The confirmation prompt must not block the happy path; it should only fire when broad/sensitive thresholds trip.

## Definition Of Done
- New selector module exists, is unit-tested, and is the only path that constructs the chat `context` payload.
- `local_only` items and sensitive-category items are excluded by default with explicit, per-turn confirmation when included.
- Packets respect `budget.maxTotalChars` and pass the shared Zod schema.
- Manual Android pass for at least the four scenarios above.
- No personal content is logged outside the API request body.
