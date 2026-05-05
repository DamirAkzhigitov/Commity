# Task: Settings Screen Subscription UI

## User Story
As a user, I want to view and manage my subscription status in Settings so that I know my current plan.

## Scope
- In: Settings screen UI updates for Free/Pro states, links to Paywall, links to OS subscription management.
- Out: Paywall UI (handled in separate task).

## Acceptance Criteria
- [ ] Given a Free user, when they open Settings, then they see "Free Plan" and an "Upgrade to Pro" button that opens the Paywall.
- [ ] Given a Pro user, when they open Settings, then they see "Pro Plan" and their renewal date.
- [ ] Given a Pro user, when they tap "Manage Subscription", then they are deep-linked to the iOS App Store or Google Play subscription page.

## Implementation Notes
- Mobile: Update `apps/mobile/app/(tabs)/settings.tsx` (or equivalent). Use RevenueCat SDK to check current entitlement status on mount/focus.
