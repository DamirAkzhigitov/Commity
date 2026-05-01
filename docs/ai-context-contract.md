# AI Context Contract And Assistant Proposals (MVP)

## Purpose
Define the request/response contract for `POST /assistant/chat` so mobile, API, and shared schemas remain stable and testable.

## Endpoint
- Method: `POST`
- Path: `/assistant/chat`
- Auth: `Authorization: Bearer <JWT>`
- Content-Type: `application/json`
- Behavior: stateless AI proxy (no personal content persistence)

After shared-schema validation succeeds, the server may format `context.items` into a bounded, deterministic plain-text section for provider input only. Items with `includeInAi: false` are omitted. The structured request body including context is never stored as persistent personal content by the MVP API.

## Request Contract

### Root Fields
- `clientRequestId` (required): UUID v4
- `message` (required): string, trimmed, length `1..32000`
- `locale` (optional): BCP-47 tag, max length 32
- `context` (optional): bounded local context packet

### Context Packet
- `schemaVersion` (required): integer, `1`
- `budget` (required):
  - `maxTotalChars` required integer, `2000..50000`
  - `estimatedChars` optional integer
- `privacy` (required):
  - `userConfirmedBroaderContext` required boolean
- `conversationSummary` (optional): max length 2000
- `items` (required): array, max 40

### Context Item
- `kind` (required enum): `task | subitem | document | reminder | memory | chat_excerpt`
- `localId` (required): string length `1..128`
- `titleOrLabel` (optional): max length 512
- `bodySnippet` (optional): max length 2000
- `metadata` (optional object):
  - max 16 keys
  - key length max 64
  - scalar value serialized length max 256
  - recommended keys: `taskId`, `subitemId`, `documentType`, `dueAt`,
    `remindAt`, `status`, `priority`, `importance`, `pinned`
- `includeInAi` (required boolean): false means do not send in model prompt

Task context should be hierarchical where practical: include the Task as the
outcome container, then include only the most relevant Subitems, Documents, and
Reminders. Document context should use safe names, metadata, and short snippets;
full file contents are not sent by default.

## Response Contract

### Root Fields
- `clientRequestId` (echo when provided)
- `mode`: `mock | openai`
- `reply`: assistant text
- `proposals`: structured proposed actions (possibly empty)

### Proposal Rules
- Proposals are suggestions only.
- Any create/update/delete/schedule action requires explicit user confirmation.
- `proposals.length <= 20`
- Each proposal should include:
  - `proposalId`: UUID v4
  - `type`: discriminated union key
  - `confidence`: optional float `0..1`
  - `payload`: type-specific payload

### Proposal Types
- `noop`
- `create_task`
- `create_subitem`
- `upsert_document`
- `schedule_reminder`
- `update_item`
- `delete_item`

`update_item` and `delete_item` must identify the local item kind and local id.
Supported MVP item kinds are `task`, `subitem`, `document`, and `reminder`.

## Validation And Error Model

### Validation Rules
- Reject empty or oversized `message`.
- Reject invalid UUID in `clientRequestId`.
- Reject context packets that exceed declared budget.
- Reject invalid enums, over-limit arrays, and oversized strings.

### HTTP Statuses
- `200`: success
- `400`: validation failure
- `401`: missing/invalid auth
- `403`: entitlement/quota policy denial
- `413`: request body too large
- `429`: rate-limited
- `500`: internal/provider error

### Machine-Readable Error Shape
```json
{
  "error": {
    "code": "CONTEXT_PACKET_TOO_LARGE",
    "message": "Human-readable summary",
    "details": {}
  }
}
```

### Stable Error Codes
- `AUTH_REQUIRED`
- `ENTITLEMENT_INACTIVE`
- `ASSISTANT_QUOTA_EXCEEDED`
- `CONTEXT_PACKET_TOO_LARGE`
- `CONTEXT_PACKET_INVALID`
- `CHAT_MESSAGE_INVALID`
- `REQUEST_VALIDATION_FAILED`
- `AI_PROVIDER_ERROR`
- `INTERNAL_ERROR`

## Local-First Privacy Rules
- Personal content remains local by default.
- API stores operational metadata only.
- Private/sensitive items are excluded from context by default.
- Provider keys are never exposed to mobile clients.
- Task Documents can be sensitive; mobile should send document snippets only
  when the user has not marked them private/local-only and the snippet is needed
  for the current assistant request.

## Minimal Example

### Request
```json
{
  "clientRequestId": "c2b3e4a1-7f0d-4c2a-9e1b-11aa22bb33cc",
  "message": "Help me organize the passport renewal.",
  "locale": "en-US",
  "context": {
    "schemaVersion": 1,
    "budget": { "maxTotalChars": 8000, "estimatedChars": 420 },
    "privacy": { "userConfirmedBroaderContext": false },
    "items": [
      {
        "kind": "document",
        "localId": "doc_7f3a",
        "titleOrLabel": "Passport renewal form",
        "bodySnippet": "Needs photo, old passport number, mailing address.",
        "metadata": {
          "taskId": "task_passport",
          "documentType": "form"
        },
        "includeInAi": true
      }
    ]
  }
}
```

### Response
```json
{
  "clientRequestId": "c2b3e4a1-7f0d-4c2a-9e1b-11aa22bb33cc",
  "mode": "openai",
  "reply": "I can turn this into a passport renewal Task with the first steps and a Reminder. Confirm to save it locally.",
  "proposals": [
    {
      "proposalId": "9d4c2b1e-6a0f-4d3c-8b2a-0f1e2d3c4b5a",
      "type": "create_task",
      "confidence": 0.72,
      "payload": {
        "title": "Renew passport",
        "description": "Complete and submit the passport renewal form.",
        "priority": "high",
        "dueAt": "2026-05-15T17:00:00.000Z",
        "subitems": [
          { "title": "Take passport photo" },
          { "title": "Fill out renewal form" },
          { "title": "Mail renewal packet" }
        ],
        "documents": [
          {
            "title": "Passport renewal form",
            "documentType": "form",
            "localId": "doc_7f3a"
          }
        ]
      }
    }
  ]
}
```
