# Assistant Documentation Index (MVP)

## Purpose
This is the quick navigation page for assistant architecture and implementation decisions.  
Use it to understand each document in one minute and open only what you need.

## Core Documents

- [Assistant Architecture Guardrails](./assistant-architecture-guardrails.md)  
  Defines system boundaries, ownership by layer (mobile/API/LLM), non-negotiable privacy and confirmation rules, fail-safe behavior, and top risks with mitigations.

- [AI Context Contract And Assistant Proposals](./ai-context-contract.md)  
  Defines `POST /assistant/chat` request/response contracts, field constraints, proposal types, validation rules, error model, and a minimal example payload.

- [Milestone Acceptance Criteria: Assistant Context And Proposals](./milestone-assistant-context-acceptance.md)  
  Defines what must be implemented and tested for milestone completion, including unit/integration/contract coverage and definition of done.

## Related Product And Planning Documents

- [Product MVP](./product-mvp.md)  
  High-level MVP intent and scope.

- [Architecture](./architecture.md)  
  Broader system architecture context outside this assistant-specific contract.

- [Current State And Next Steps](./current-state-and-next-steps.md)  
  Snapshot of implementation status, open questions, and sequencing.

- [Product Planning Root](./product/README.md)  
  Entry point for requirements, epics, and implementation tasks.

## Product Folder Contents

- [Product Planning](./product/README.md)  
  Root index for product planning artifacts and folder conventions.

- [Requirements Index](./product/requirements/README.md)  
  Entry point for requirement documents and requirement-writing guidance.

- [REQ-001: MVP Development Sequence](./product/requirements/REQ-001-mvp-development-sequence.md)  
  Defines the phased implementation order and MVP execution sequence.

- [Epics Index](./product/epics/README.md)  
  Entry point for epic-level planning documents.

- [EPIC-001: Usable MVP Core Loop](./product/epics/EPIC-001-usable-mvp-core-loop.md)  
  Defines the primary user and delivery outcome for the first usable assistant loop.

- [Tasks Index](./product/tasks/README.md)  
  Entry point for implementation-ready task breakdown.

- [TASK-001: Backend Foundation Auth AI Usage](./product/tasks/TASK-001-backend-foundation-auth-ai-usage.md)  
  Backend foundation task for auth, AI proxy, and usage enforcement baseline.

- [TASK-002: Shared Assistant Action Contracts](./product/tasks/TASK-002-shared-assistant-action-contracts.md)  
  Shared-schema task for context packets and assistant action contracts.

- [TASK-003: Mobile Local Data And Chat Shell](./product/tasks/TASK-003-mobile-local-data-and-chat-shell.md)  
  Mobile task for local-first data setup and initial chat shell integration.

- [TASK-004: Mobile Confirmed Reminders](./product/tasks/TASK-004-mobile-confirmed-reminders.md)  
  Mobile task for confirmation-gated reminder scheduling and UX flow.

- [TASK-005: Restore Chat History And API Context](./product/tasks/TASK-005-restore-chat-history-and-api-context.md)
  Fix multi-turn chat rendering on mobile and wire API model input to privacy-filtered context items.

- [TASK-006: Task Subitems And Documents Model](./product/tasks/TASK-006-task-subitems-documents-model.md)
  Defines the next implementation slice for outcome-oriented Tasks, Subitems, Documents, linked Reminders, and local context support.

## Recommended Reading Order
1. `assistant-architecture-guardrails.md` (why and boundaries)
2. `ai-context-contract.md` (exact payload and error contract)
3. `milestone-assistant-context-acceptance.md` (what must pass)
4. `docs/product/README.md` (planning structure)
5. `docs/product/requirements/REQ-001-mvp-development-sequence.md` (sequence)
6. `docs/product/epics/EPIC-001-usable-mvp-core-loop.md` (outcome framing)
7. `docs/product/tasks/` (implementation tasks in order)

## Document Ownership
- Product/strategy updates: CTO + Product Owner
- API contract updates: Backend + Shared package owners
- Client context and confirmation flow updates: Mobile owner

When changing any contract field, update all three core documents in the same PR.

## Agent Note
AI agents working in this repository should use this file as the first documentation entry point, then follow links to detailed docs by scope.
