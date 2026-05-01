# EPIC-002: Local Context Assistant Quality

## Goal
Improve assistant usefulness after the core loop by building higher-quality local context packets on-device, grounding assistant responses in recent and relevant local data, and preserving the local-first privacy model.

## Problem / Opportunity
EPIC-001 proves that users can chat, review structured proposals, and save personal assistant data locally. The next product risk is assistant quality: without reliable local context selection, the assistant may miss existing tasks, duplicate reminders, ignore goals, or give generic responses.

The opportunity is to make the assistant feel personally useful while keeping tasks, notes, reminders, goals, memory, and chat history owned by the mobile app. The backend should remain an authenticated AI proxy with entitlement, quota, usage, and billing responsibilities only.

## Why Now
Local context is already part of the MVP scope and shared assistant contracts. This epic turns the first chat shell into a quality loop that can be evaluated before adding billing polish, voice, cloud sync, or broader integrations.

## Included Requirements
- `REQ-001-mvp-development-sequence.md`

## Goals
- Build bounded context packets locally from tasks, notes, reminders, goals, memory summaries, and recent chat.
- Apply privacy filtering before any context leaves the device.
- Improve assistant responses by including relevant due dates, incomplete work, recent decisions, source metadata, and user goals.
- Add deterministic tests or fixtures for context ranking, redaction, packet size limits, and assistant proposal quality.
- Keep backend usage records free of personal message content and context packet content.

## Non-Goals
- Server-stored personal memory, tasks, notes, reminders, goals, or chat history.
- Cloud sync or multi-device conflict resolution.
- Local vector database, on-device embedding model, or offline AI.
- Voice input, transcription, or proactive background agents.
- Calendar, email, or third-party productivity integrations.

## Scope
- In:
  - Local context retrieval using SQLite fields, recency, due dates, completion state, importance, source metadata, and simple text search.
  - Context packet budgeting so mobile sends only the smallest useful context window.
  - Privacy flags and sensitive-category filtering before backend AI calls.
  - User confirmation before sending unusually sensitive or broad personal context.
  - Assistant prompt/response handling that favors grounded answers and avoids duplicate local items.
  - Quality evaluation fixtures for common personal assistant scenarios.
- Out:
  - Backend persistence of personal assistant context.
  - Server-side vector search or embeddings.
  - Push reminders or server-driven proactive suggestions.
  - Fully autonomous mutations without visible user confirmation.

## Dependencies
- `EPIC-001-usable-mvp-core-loop.md`
- `TASK-002-shared-assistant-action-contracts.md`
- `TASK-003-mobile-local-data-and-chat-shell.md`
- `TASK-004-mobile-confirmed-reminders.md`
- Local encrypted SQLite storage for personal assistant entities.
- Backend assistant endpoint that accepts typed context packets without persisting personal content.

## Milestones / Tasks
- `TASK-005-mobile-local-context-retrieval.md`: Build local context selection, ranking, privacy filtering, packet budgeting, and tests.
- `TASK-006-assistant-quality-grounding.md`: Tune assistant prompt handling and proposal behavior so responses use context, avoid duplicates, and explain uncertainty.
- `TASK-007-context-quality-evaluation.md`: Add repeatable evaluation fixtures covering tasks, notes, reminders, goals, sensitive data exclusion, and packet size limits.

## Done When
- [ ] The mobile app builds a bounded context packet locally before assistant requests.
- [ ] Local-only/private items are excluded from context by default.
- [ ] Sensitive or unusually broad context requires explicit user confirmation before sending.
- [ ] Context packet size limits are enforced and tested.
- [ ] Assistant responses reference relevant local context when available and avoid obvious duplicate task/reminder proposals.
- [ ] Quality fixtures cover at least task follow-up, reminder disambiguation, note recall, goal alignment, and sensitive-context exclusion.
- [ ] Backend usage events and logs do not store personal messages, assistant replies, or context packet content.

## Success Metrics
- At least 80% of local quality fixtures pass without manual correction.
- Context packets stay within the agreed MVP budget for normal use cases.
- No known personal assistant content is persisted in backend Postgres or usage logs.
- Manual Android testing confirms the assistant can use local tasks, notes, reminders, and goals to produce useful proposals.
- Fewer duplicate task/reminder proposals in evaluated flows compared with the EPIC-001 chat shell baseline.

## Risks And Mitigations
- Risk: Context packets become too large or expensive.
  - Mitigation: Enforce strict packet budgets, rank locally, and prefer summaries or metadata over full content.
- Risk: Private or sensitive data is sent to AI unintentionally.
  - Mitigation: Default-exclude private/local-only items, carry privacy metadata through shared schemas, and require confirmation for broad or sensitive context.
- Risk: Assistant responses become overconfident when context is incomplete.
  - Mitigation: Prompt for uncertainty, include source metadata, and test ambiguous scenarios.
- Risk: Ranking quality is poor without embeddings.
  - Mitigation: Start with deterministic SQLite search, recency, due dates, importance, and completion state; defer embeddings until after MVP evidence.
