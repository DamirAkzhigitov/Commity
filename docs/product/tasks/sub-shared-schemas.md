# Task: Define Shared Subscription Schemas

## User Story
As a developer, I need shared Zod schemas for subscription data so that the mobile app and backend communicate entitlements consistently.

## Scope
- In: Zod schemas for `SubscriptionStatus`, `EntitlementInfo`, and API request/response types.
- Out: Actual API implementation.

## Acceptance Criteria
- [ ] `SubscriptionStatus` enum is defined (FREE, ACTIVE, PAST_DUE, CANCELED).
- [ ] `EntitlementInfo` schema includes status, plan ID, and expiration date.
- [ ] Schemas are exported from `@personal-assistant/shared`.

## Implementation Notes
- Shared: Add to `packages/shared/src/billing.ts` (or similar).
