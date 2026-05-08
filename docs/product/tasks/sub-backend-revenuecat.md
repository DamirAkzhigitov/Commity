# Task: Backend RevenueCat Integration

## User Story
As a system, I need to validate purchases and listen to subscription events so that users receive the correct entitlements securely.

## Scope
- In: RevenueCat webhook endpoint, user table schema updates for subscription status.
- Out: Direct Apple/Google API integration (RevenueCat handles this).

## Acceptance Criteria
- [ ] Given a RevenueCat webhook payload, when received, then the backend verifies the signature and updates the user's `subscription_status` and `expires_at` in Postgres.
- [ ] Given a user request for profile data, when the user is authenticated, then the backend returns their current subscription entitlement.

## Implementation Notes
- Backend: Create a `BillingModule` in NestJS. Add webhook controller. Update Prisma schema with `subscriptionStatus`, `subscriptionExpiresAt`.
