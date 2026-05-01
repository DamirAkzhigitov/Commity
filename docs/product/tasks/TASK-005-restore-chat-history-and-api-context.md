# TASK-005: Restore Chat History Rendering And API Context Usage

## Outcome
Mobile chat shows persisted multi-turn history (not only the latest assistant reply), and the API uses privacy-filtered `context.items` when building model input instead of the raw user message alone.

## Type
Shared

## Problem Statement
After `TASK-003`, the chat flow regressed in two places:

1. Mobile persists chat rows locally, but `apps/mobile/app/(tabs)/chat.tsx` renders only the latest assistant `reply` state instead of the full local chat history.
2. Mobile sends a shared-schema `context` packet, but `apps/api/src/assistant/assistant.service.ts` only passes the raw `message` to OpenAI and action planning.

## User / Business Impact
The assistant feels stateless and forgetful: users cannot see prior turns, and the model cannot use relevant local Tasks, Subitems, Documents, and Reminders that mobile already filtered and sent. This weakens the MVP core loop and makes proposal quality worse.

## Scope

### In
- Render recent local chat history on mobile from encrypted SQLite.
- Keep new user/assistant messages appended to the visible history.
- API should validate and transform allowed `context.items` into bounded model input.
- API must ignore `includeInAi: false` items.
- Add focused tests for both regressions.

### Out
- Backend persistence of personal chat/context.
- Cloud sync.
- Vector search or long-term memory.
- Server-side reminder/task mutations.
- New context contract fields unless required by existing shared schemas.

## Acceptance Criteria
- [x] Opening chat shows recent persisted user and assistant messages, not only the latest assistant reply.
- [x] Sending multiple messages in one session displays all recent turns in order.
- [x] Restarting/reloading the app still shows persisted local chat history.
- [ ] `POST /assistant/chat` with valid context causes allowed context items to be included in OpenAI model input.
- [ ] Items with `includeInAi: false` are not included in model input.
- [ ] API still stores only operational usage metadata, not personal message/context content.
- [ ] Existing shared request validation remains the contract boundary.

## Technical Investigation Notes
- `TASK-003` expects local SQLite chat, context packets, and privacy filtering.
- `ai-context-contract.md` defines optional `context` on `POST /assistant/chat`.
- `apps/mobile/app/(tabs)/chat.tsx` inserts user and assistant rows but only renders `reply`.
- `apps/mobile/lib/local-db.ts` has `insertChatMessage` but no obvious decrypted chat-history loader yet.
- `apps/api/src/assistant/assistant.controller.ts` validates with `assistantChatRequestSchema`.
- `apps/api/src/assistant/assistant.service.ts` currently destructures `{ clientRequestId, message }` and sends only `message` to OpenAI.

## Implementation Notes
1. Add a mobile local DB helper to load recent chat messages, decrypt bodies, order oldest-to-newest for display, and cap the result.
2. Update chat screen state from `reply` to `messages`, loading persisted history on mount/focus and appending new user/assistant rows after send.
3. Keep proposals associated with the latest assistant response only for now.
4. In API service, build model input from:
   - system prompt,
   - a compact context section from `request.context.items.filter(includeInAi)`,
   - the raw user message.
5. Ensure context formatting is bounded, deterministic, and excludes `includeInAi: false`.
6. Add tests proving the API includes allowed context and excludes disallowed/private context.

## Dependencies
- `TASK-003-mobile-local-data-and-chat-shell.md`
- `TASK-002-shared-assistant-action-contracts.md` (shared schemas / contract boundary)

## Verification

### Manual
- Send two chat messages on Android; verify both user messages and both assistant replies remain visible.
- Restart the app; verify the same chat history loads from local storage.
- Create a local Task/Subitem/Document, send a related chat message, and verify API debug/mocked OpenAI input receives the filtered context.
- Mark an item local-only/private and verify it is not sent to model input.

### Automated
- Mobile unit test for chat-history load/decrypt ordering and limit.
- Mobile component or wiring test that multiple chat sends render multiple turns.
- API unit test with mocked OpenAI client capturing `responses.create` input.
- API test asserting `includeInAi: true` context appears in model input.
- API test asserting `includeInAi: false` context does not appear.
- Regression test that invalid context is rejected before provider call.

## Risks / Dependencies
- React Native component testing may be limited; prefer local DB/helper tests plus minimal screen wiring tests.
- Context formatting must avoid logging personal content.
- Must preserve local-first boundary: API may use context transiently for model input but must not persist it.
- Depends on existing shared assistant schemas from `packages/shared`.

## Definition Of Done
- Mobile renders persisted multi-turn chat history.
- API uses filtered context in provider calls.
- Tests cover both regressions.
- No backend personal-content persistence or raw context logging is introduced.
- Relevant task/doc notes are updated if implementation changes the contract or milestone behavior.

## Implementation Record (2026-05-01)
- **Mobile:** `loadRecentChatMessagesDecrypted` reads `chat_messages` (newest-first window, decrypt, oldest→newest). Chat tab uses `chatMessages` state, `useFocusEffect` reload, no `setReply` clear on send; appends user row after insert then assistant row after API success; reloads from DB on errors. `lib/chat-history.ts` provides `recentSliceOldestFirst` (tested for limit/order).
- **API:** `assistant-context-input.ts` builds bounded deterministic context text (`includeInAi !== false`, sort by `kind` + `localId`); `AssistantService` wraps user message for `responses.create`; `planActions` unchanged (message-only).
- **Tests:** Vitest for `recentSliceOldestFirst`; Jest unit for formatter + mocked `openai.responses.create` input; e2e includes invalid `context` 400; usage persistence case tolerates `mock` vs `openai` when `.env` configures a key.
- **Docs:** `ai-context-contract.md` clarifies server-side use of privacy-filtered context for prompts only.
