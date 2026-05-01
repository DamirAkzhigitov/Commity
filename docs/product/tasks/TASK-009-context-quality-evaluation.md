# TASK-009: Context Quality Evaluation

## Outcome
A small, repeatable evaluation harness scores assistant quality against fixed local-context fixtures so changes to selection (TASK-007) and grounding (TASK-008) can be measured before merge.

## Type
Backend | Shared

## Problem Statement
EPIC-002 says "at least 80% of local quality fixtures pass without manual correction" but no fixtures or scoring harness exist. Without this, every assistant-quality change is judged by feel, and we cannot detect regressions across PRs.

## User / Business Impact
A measurable quality bar protects ongoing assistant usefulness, prevents silent regressions, and gives reviewers (and future contributors) something concrete to point to when a change makes proposals worse.

## Scope

### In
- A fixtures directory with at least one fixture per EPIC-002 success scenario:
  - Task follow-up: existing Task → assistant updates rather than creates.
  - Subitem completion: existing Task with Subitems → assistant proposes status updates / completion.
  - Document recall: relevant Task-scoped Document is referenced in the reply.
  - Reminder disambiguation: existing Reminder near the same time → assistant updates instead of creating a duplicate.
  - Sensitive-context exclusion: a `documentType=health` item is in local rows but excluded by default.
- A deterministic evaluation runner that:
  - Loads each fixture (input message, local context rows, expected outputs).
  - Runs the mobile selector (TASK-007 entry point) against the rows.
  - Calls the API path with a stubbed/mocked model that returns a recorded response, then runs grounding enforcement (TASK-008).
  - Scores per-fixture pass/fail against expected proposal kinds, expected `localId` reuse, and expected reply markers (e.g., "uncertain", "already exists").
- A summary report (printed and asserted) showing pass rate.
- Test command wired into existing scripts (e.g., `npm test -w @personal-assistant/api -- --testPathPattern=quality`).

### Out
- Real-model evaluations (paid OpenAI calls) in CI.
- Cross-locale fixtures.
- Multi-turn evaluations beyond one assistant turn.
- Statistical significance tooling (sample sizes are intentionally small).

## Acceptance Criteria
- [ ] At least 5 fixtures live under `apps/api/test/quality-fixtures/` (or equivalent), each with `input.json`, `localRows.json`, `mockedModelOutput.json`, and `expected.json`.
- [ ] A runner under `apps/api/test/quality/` (Jest) loads every fixture, runs selection + grounding, and reports per-fixture and aggregate pass rate.
- [ ] The runner asserts an MVP target of `>= 80%` pass rate; failing fixtures print a stable reason code (`UNEXPECTED_PROPOSAL_TYPE`, `MISSING_LOCAL_ID_REUSE`, `SENSITIVE_ITEM_LEAKED`, `MISSING_UNCERTAINTY_MARKER`, `OVER_BUDGET`).
- [ ] Personal content does not leave the runner: fixtures are synthetic and the runner never logs full payloads, only reason codes and pass/fail booleans.
- [ ] `docs/milestone-assistant-context-acceptance.md` (or a new `docs/quality-evaluation.md` if that doc is contract-locked) is updated to describe the harness and how to add a fixture.
- [ ] CI command exists and passes from a clean checkout: `npm test -w @personal-assistant/api -- --testPathPattern=quality`.

## Technical Investigation Notes
- `apps/api` already has Jest unit and e2e test setups; the runner should be unit-style (no Postgres) for speed.
- `packages/shared` exports `assistantChatRequestSchema` and `assistantChatResponseSchema`, which the runner should use to validate fixture inputs/outputs.
- The mobile selector from TASK-007 is consumable from the runner via the shared package boundary if exposed as a pure function; if it must remain in `apps/mobile`, copy a thin pure version into a shared utility under `packages/shared` or test the selector via its own Vitest and run only the API-side grounding here.
- Mocked model outputs avoid OpenAI dependency and keep CI deterministic.

## Implementation Notes
1. Create `apps/api/test/quality-fixtures/<scenario>/` directories with the four files above.
2. Implement `apps/api/test/quality/runner.spec.ts` that:
   - Glob-loads fixtures.
   - Validates each fixture against the shared Zod schemas before running.
   - Runs grounding enforcement using the same module shipped in TASK-008.
   - Compares produced proposals + reply markers to `expected.json`.
   - Aggregates `pass / total` and asserts `pass / total >= 0.8`.
3. Add a stable list of reason codes for failures and print them in test output for debuggability.
4. Document fixture authoring in a short README under `apps/api/test/quality-fixtures/README.md`.

## Dependencies
- `TASK-007-mobile-local-context-retrieval.md`
- `TASK-008-assistant-quality-grounding.md`

## Verification

### Manual
- Add a deliberately-broken fixture (e.g., expects `update_item` but mock returns `create_task` with no grounding). Confirm the runner fails with `UNEXPECTED_PROPOSAL_TYPE`.
- Tighten one fixture's `maxTotalChars` to force trimming; confirm the runner's selection step trims as expected without exceeding the budget.

### Automated
- Jest: runner passes with the shipped fixtures (≥ 80%).
- Jest: each reason code is exercised by at least one negative test fixture toggled on demand.
- Lint/typecheck: `npm run typecheck` remains green.

## Risks / Dependencies
- Mocked model outputs only validate prompt/post-filter behavior, not raw model quality. That is acceptable for MVP and keeps CI free of paid AI calls.
- Fixture authors must not include real personal data; enforce a short reviewer checklist in the fixtures README.
- Without TASK-007/TASK-008, the runner cannot exercise selection or grounding paths fully; sequence them accordingly.

## Definition Of Done
- Fixture set covers all five EPIC-002 success scenarios.
- Runner asserts the MVP 80% pass rate and prints a clear failure summary.
- Docs explain how to add a fixture and what reason codes mean.
- CI command runs from a clean checkout and stays deterministic.
- No personal content is logged or persisted.
