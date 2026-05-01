# Assistant Architecture Guardrails (MVP)

## Purpose
Define the non-negotiable boundaries for the AI assistant so product goals, engineering decisions, and privacy constraints stay aligned during MVP delivery.

## CTO Confirmation
This plan is aligned with the MVP goal: an AI-chat-first personal assistant that converts natural conversation into structured, local-first productivity actions while keeping sensitive user data private and costs controlled.

## Core Product Direction
- The assistant is AI-chat-first, not chat-only.
- Chat is the primary input surface.
- MVP navigation is fixed to Chat, Tasks, Reminders, and Settings.
- Tasks are first-class outcome containers with Subitems and Documents.
- Reminders are simple time-based prompts tied to a Task or Subitem.
- The assistant proposes actions; the user remains in control of final mutations.

## Responsibility Boundaries

### Mobile Client
- Own local-first personal data by default: chat history, Tasks, Subitems, Documents, Reminders, memory, privacy flags, and action history.
- Build the AI context packet locally from relevant data only.
- Exclude private/local-only/sensitive items from AI context by default.
- Render assistant reply and proposed actions.
- Require explicit user confirmation before applying create, update, delete, complete, attach, or schedule actions.
- Schedule reminders locally after user confirmation.

### API
- Verify authentication and entitlement before model calls.
- Enforce quota and rate limit policy.
- Validate request and response payloads using shared schemas.
- Proxy requests to model provider; provider keys must never be in the mobile app.
- Store operational usage metadata only (for example: model, token usage, latency, cost estimate, outcome).
- Do not persist personal message content, full context payload, task text, subitem text, document content, or reminder text.

### LLM
- Return assistant reply and schema-valid action proposals only.
- Ask for clarification when required data is missing.
- Never be treated as source of truth for permission, privacy, quota, or data mutation.

## Non-Negotiable Guardrails
- Local-first data ownership is default behavior.
- All assistant mutations are proposals requiring user confirmation.
- Cross-boundary payloads must be schema-validated.
- Sensitive and user-marked private data is excluded from AI context by default.
- API logs and usage records must not contain personal content payloads.
- If validation, quota, or model output parsing fails, fail safe: no local mutations.
- Destructive actions require explicit confirmation and should be undoable where practical.
- Debug outputs must be developer-safe and avoid raw personal content.

## Fail-Safe Behavior
- If request validation fails: return a structured error and do not call the model.
- If model output fails schema parsing: return assistant fallback text with no action proposals.
- If entitlement/quota fails: return policy error, no model call, no local mutation.
- If client cannot apply an action: keep original local data unchanged and surface retry/edit options.

## Operational Observability
- Track only non-sensitive telemetry:
  - request id
  - user id (or hashed internal id policy)
  - feature name
  - model id
  - input/output token counts
  - estimated cost
  - latency
  - success/failure code
- Add alerts for quota spikes, model failure rates, and schema parse failures.

## Top Risks And Mitigations
1. Privacy leakage from oversized or poorly filtered context.
   - Mitigation: strict local filtering, context caps, privacy flags, schema enforcement.
2. Invalid or unsafe model actions.
   - Mitigation: schema validation, proposal-only flow, mandatory confirmation.
3. Backend drift into personal data storage.
   - Mitigation: explicit no-content persistence policy and log redaction checks.
4. Poor extraction quality lowers trust.
   - Mitigation: confirm/edit/dismiss/undo loops and regression fixtures.
5. AI cost growth.
   - Mitigation: quota-first enforcement, bounded context budgets, cost monitoring.
