# Task: Mobile Paywall and RevenueCat SDK

## User Story
As a user, I want to see a paywall and purchase a subscription so that I can upgrade to Pro.

## Scope
- In: RevenueCat React Native SDK setup, Paywall UI screen, Purchase flow, Restore purchases flow.
- Out: Settings screen integration (handled in separate task).

## Acceptance Criteria
- [x] Given the paywall screen, when opened, then it displays the available Pro package fetched from RevenueCat.
- [x] Given the paywall, when the user taps "Buy", then the native OS purchase sheet appears.
- [x] Given a successful purchase, then the app updates the local entitlement state and closes the paywall.
- [x] Given the paywall, when the user taps "Restore", then it checks for previous purchases and restores them if valid.

## Implementation Notes
- Mobile: Install `react-native-purchases`. Create `PaywallScreen`. Ensure App Store required text (Terms/Privacy links) is visible.
