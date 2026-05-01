# TASK-001: Backend Foundation Auth AI Usage

## Outcome
The API can safely proxy assistant requests for signed-in users while enforcing entitlement and quota before any AI call.

## Type
Backend

## Resolved Decisions
- **JWT verification strategy**: Use Supabase JWKS-based token verification with standard claim checks (`iss`, `aud`, `exp`) for mobile access tokens. Keep verification server-side in the API and do not rely on client-provided trust signals.
- **Identity linkage in Postgres**: Supabase `sub` is the canonical user identity. Upsert a minimal `User` row for FK stability where needed; no personal assistant content is stored in user profile fields.
- **Schema scope right now (no legacy backlog framing)**: This task aligns the backend to the target local-first architecture now. Backend data scope is infrastructure-only (auth linkage, entitlement/subscription, usage/audit). Personal content models are not part of active backend persistence for MVP.
- **Entitlement source before billing launch**: Authenticated users receive server-evaluated entitlement from a single policy path; no client-supplied `userId` or plan state is trusted.
- **Quota policy shape**: Implement one server `QuotaPolicyService` that enforces trial (`25 messages or 3 days, whichever comes first`) and plan-based limits using the same policy interface.
- **Usage rows in mock AI mode**: Persist usage events in mock mode for parity, using `model=mock` and zero-cost/zero-token accounting as applicable.
- **Local DB + runbook**: Keep one canonical local setup path using stable tooling (Docker Compose + Prisma migrations + API boot), with required env vars documented in API env templates.

## Acceptance Criteria
- [x] Supabase Auth JWT verification protects assistant, billing, and usage endpoints.
- [x] Demo or hardcoded user IDs are removed from request handling.
- [x] Assistant requests are rejected before AI calls when the user is unauthenticated, lacks entitlement, or exceeds quota.
- [x] Usage events are persisted in Postgres with user id, model, feature, token counts, estimated cost, and timestamps.
- [x] Usage events do not store personal message content or full context packets.
- [x] Backend does not persist personal assistant content (messages, Tasks, Subitems, Documents, Reminders, context packets), and only infrastructure records are written.
- [x] API health and local development setup are documented and runnable.

## What Will Be Implemented
- **Auth boundary**: NestJS guard(s) that validate the `Authorization: Bearer` Supabase JWT, attach `userId` (and optionally email/role) to the request context, and return 401 when missing or invalid. Apply globally or per-controller to assistant, billing, and usage routes; keep `GET /health` (and optionally `GET /`) unauthenticated for ops.
- **Removal of client-trusted identity**: Delete `demo-user` defaults and `userId` query/body parameters for entitlement-sensitive operations. The authenticated subject becomes the only source of `userId` for billing checks, quota, and usage persistence.
- **Pre-AI gates**: Before any OpenAI call (or before returning mock AI results if treated as a billed “assistant turn”), enforce: valid JWT, active entitlement for that user, and quota not exceeded (messages and/or tokens per policy). Fail with 401/403 as appropriate **before** provider invocation.
- **Durable usage logging**: Replace in-memory `UsageService` storage with Prisma writes to `UsageEvent` (existing model: `userId`, `feature`, `model`, `inputTokens`, `outputTokens`, `estimatedCostUsd`, `createdAt`). Read path for quota aggregates from Postgres (filter by user + billing period).
- **Non-sensitive usage payloads**: Record only operational fields; never log or persist user message text, assistant reply text, or context packets on `UsageEvent` (or in structured app logs for these flows).
- **Local-first alignment**: Assistant handler does not insert chat messages, Tasks, Subitems, Documents, Reminders, or memory into Postgres.
- **Immediate schema alignment**: Backend persistence remains infrastructure-only for this MVP slice, matching local-first privacy and avoiding parallel personal-content storage paths.
- **Documentation**: Runnable instructions for local API + Postgres (migrate, seed if any, env template) and confirmation of the health check endpoint.

## How It Will Be Implemented
- **NestJS modules**: Add an `AuthModule` (or auth guard provider in `AppModule`) with a `SupabaseJwtAuthGuard` and optional `@CurrentUser()` decorator using Nest `ExecutionContext`. Use stable JWKS verification (RS256 and ES256 / EC signing keys) with explicit issuer/audience validation.
- **Controller changes** (`assistant`, `billing`, `usage`):
  - `POST /assistant/chat`: body contains only the chat payload agreed with TASK-002 (until then, `message` only); remove `userId` from input; inject user from guard.
  - `GET /billing/entitlement` (and mutating billing routes): require auth; derive `userId` from JWT; remove query default `demo-user`.
  - Any usage introspection endpoints: same pattern.
- **BillingService**: Replace stub with logic that reads entitlement state appropriate for MVP (DB-backed `Subscription` and/or plan defaults). Must never trust client-supplied user id.
- **Quota and entitlement policy**: Centralize checks in a policy service used by assistant and billing flows so trial and plan limits are enforced consistently before AI calls.
- **UsageService**: `record()` becomes `async` and uses `PrismaService` to `create` a `UsageEvent`; usage reads use `aggregate`/`count`/`sum` with date filters aligned to quota windows.
- **AssistantService**: Reorder `chat()`: authenticate user (via guard) → entitlement → quota → if allowed, call OpenAI or mock branch → on successful provider path (and optionally mock), record usage → return DTO. Align mock and OpenAI return types (same fields: mode, reply, plannedActions per TASK-002 evolution).
- **Estimated cost**: Start with a simple cents/USD calculation from token counts and a configurable per-model rate table in env or shared constants; upgrade later if needed. Avoid persisting raw prompts/responses.
- **Configuration**: Document `DATABASE_URL`, Supabase URL/keys needed for JWT verification, `OPENAI_API_KEY` (optional for mock), and `API_PORT`.

## API Surface
| Area | Method / path | Auth | Notes |
|------|----------------|------|--------|
| Health | `GET /health` | Public | Liveness for orchestration and local checks. |
| Assistant | `POST /assistant/chat` | JWT required | Body: chat request schema (shared package post–TASK-002). No `userId` in body. |
| Billing | `GET /billing/entitlement` | JWT required | Returns plan + active flag for authenticated user. |
| Billing | `POST /billing/google-play/verify` | JWT required (recommended) | Body: purchase fields only; `userId` from token. |
| Usage | Any read/debug routes added | JWT required | If exposed, only the caller’s aggregated usage. |

Exact paths should match existing controllers unless renamed in implementation; new routes are acceptable if they mirror this contract.

## Data and Security Notes
- **Privacy**: Personal assistant content stays on-device per EPIC-001; the API may receive messages only as transient request bodies for AI proxying. Do not write that content to Postgres, usage rows, or long-lived logs. If structured logging is added later, scrub or omit message bodies.
- **JWT**: Validate signature, `exp`, and standard claims; reject unsigned or wrong-audience tokens. Do not expose service-role keys to the mobile app.
- **Quota bypass**: All assistant/billing/usage routes in scope must go through the guard so there is no unauthenticated shortcut.
- **Backend storage boundary**: Infrastructure data only in Postgres for MVP. No backend writes for personal Tasks, Subitems, Documents, Reminders, chat history, or memory content.

## Test Plan
- **Auth**: Request to `POST /assistant/chat` without `Authorization` → 401. Malformed or expired JWT → 401.
- **Identity**: Request with valid JWT never uses a body/query `userId`; optional test that spoofed `userId` in body is ignored.
- **Entitlement**: Stub or seed user with `active: false` → 403 before any OpenAI client call (assert mock: OpenAI client not invoked if using a test double).
- **Quota**: Seed or insert usage events to exceed plan limit → next chat returns 403; verify no new OpenAI invocation.
- **Usage persistence**: Successful (mock or stubbed OpenAI) chat creates one `UsageEvent` with expected `userId`, `feature`, `model`, token fields, `estimatedCostUsd`, and `createdAt`; assert row count in test DB.
- **No content in usage**: Assert usage payload columns and any log stubs do not contain user message text.
- **Health**: `GET /health` remains 200 without auth.

Prefer integration tests with a test Postgres (or Prisma + SQLite only if the team adds a test datasource; otherwise Dockerized Postgres in CI).

## Implementation Notes
- Keep backend Postgres limited to infrastructure data for MVP.
- Add a minimal quota policy first; refine exact plan limits before billing launch.
- Make mock AI mode produce the same response shape as real AI mode.

## Dependencies
- `TASK-002-shared-assistant-action-contracts.md`
- Supabase project and local environment values.

## Verification
- Unit or integration tests cover auth rejection, quota rejection, and successful usage event persistence.

---

## Implementation notes (2026-04)

- **Auth**: `SupabaseJwtAuthGuard` + `SupabaseJwtVerifierService` validate **RS256 and ES256** JWTs via Supabase JWKS (`SUPABASE_URL`, optional `SUPABASE_JWT_AUD`, default `authenticated` or comma-separated list), issuer `${SUPABASE_URL}/auth/v1`. Uses `jsonwebtoken` + `fetch` + `crypto.createPublicKey` (avoids ESM-only `jose` in Jest).
- **Identity**: `User.id` is Supabase `sub`; guard upserts `{ id: sub, email }` on each authenticated request. `demo-user` and body/query `userId` removed from assistant and billing.
- **Gates**: Assistant flow = JWT → entitlement (trial 25 msgs / 3 days or active subscription) → monthly quota for subscribers → AI (or mock) → `UsageEvent` insert only (no message text).
- **Usage**: `UsageService.record` writes Prisma rows; mock mode uses `model=mock` and zero tokens/cost.
- **Tests**: `npm test` = unit only; `npm run test:e2e` requires Postgres + `prisma migrate deploy`.
- **Docs**: `docker-compose.yml`, `apps/api/.env.example`, `apps/api/README.md`.

## Supabase work report (2026-04)

- **Objective**: Aligned `apps/api` and remote Supabase to infrastructure-only persistence and resolved migration drift/failures.
- **Migration hardening**: Updated `20260430180500_infra_only_schema_and_rls` to keep infra-only cleanup and RLS while guarding `REVOKE` statements behind role existence checks for `anon` and `authenticated`.
- **Documentation alignment**: Updated `docs/sql/supabase-baseline-security.sql` with the same guarded role revoke logic for cross-environment execution.
- **Infra-only cleanup migration**: Added `20260430182000_drop_unused_vector_extension` to remove unused `vector` extension in infra-only mode.
- **Local DB operations**: Resolved failed migration state (`prisma migrate resolve --rolled-back 20260430180500_infra_only_schema_and_rls`), deployed migrations, and regenerated Prisma client.
- **Remote Supabase operations**: Applied migrations `20250430120000_init`, `20260430180500_infra_only_schema_and_rls`, and `20260430182000_drop_unused_vector_extension` via MCP.
- **Verification**: Local and remote schema now contain `public.User`, `public.UsageEvent`, and `public.Subscription` only (plus migration metadata); RLS is enabled on infra tables.
- **Security advisor status**: `extension_in_public` warning is resolved; remaining `rls_enabled_no_policy` findings are info-level and expected under deny-by-default lock-down.
