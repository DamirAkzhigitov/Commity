# Epic: Subscription & Billing MVP

## Objective
Enable users to purchase, manage, and restore a premium subscription directly from the mobile app's Settings screen, unlocking higher AI quotas and advanced features.

## Scope
- Native In-App Purchases (IAP) for iOS and Android.
- Settings UI states for Free, Active, and Expired users.
- Backend receipt validation and entitlement management.
- Subscription-based quota enforcement.

## Out of Scope (MVP)
- Multi-tier subscriptions (e.g., Plus vs. Pro vs. Max).
- Stripe/Web checkout.
- Family sharing.

## Key Requirements
See `docs/product/requirements/subscription-management.md` for detailed functional, UX, and technical requirements.

## Implementation Plan
We will use **RevenueCat** to handle cross-platform IAP infrastructure, receipt validation, and webhooks. This minimizes backend complexity and ensures compliance with App Store/Google Play guidelines.

## Tasks
1. `docs/product/tasks/sub-shared-schemas.md`
2. `docs/product/tasks/sub-backend-revenuecat.md`
3. `docs/product/tasks/sub-mobile-paywall.md`
4. `docs/product/tasks/sub-mobile-settings-ui.md`
5. `docs/product/tasks/sub-backend-quota-enforcement.md`
