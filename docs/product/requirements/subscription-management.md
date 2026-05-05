# Subscription Management in Settings

## 1. Problem Statement and Goals
**Problem:** Users need a self-serve way to upgrade to a paid subscription to access premium AI features (higher quotas, advanced models) directly from the mobile app, and manage their subscription status.
**Goals:**
- Provide a clear, frictionless upgrade path in the Settings screen.
- Securely validate purchases to prevent fraud.
- Ensure the backend is the source of truth for subscription entitlements.
**Non-Goals (MVP):**
- Multiple subscription tiers (stick to one "Pro" tier).
- Web-based Stripe checkout (use native IAP to avoid App Store/Play Store rejection).
- Family sharing or team plans.
- Prorated refunds handled in-app (defer to OS-level management).

## 2. Target Users and Key Journeys
**Target Users:** Active free users hitting AI quotas, and existing premium users managing their plan.
**Key Journeys:**
- **Upgrade:** User navigates to Settings -> taps "Upgrade to Pro" -> views benefits -> confirms native IAP -> backend grants entitlement -> UI updates to "Pro".
- **Restore:** User reinstalls app -> navigates to Settings -> taps "Restore Purchases" -> backend verifies receipt -> entitlement restored.
- **Manage:** Pro user navigates to Settings -> taps "Manage Subscription" -> redirected to OS subscription management screen (App Store/Google Play).

## 3. Functional Requirements
- **Subscribe:** Initiate native IAP flow for monthly/yearly recurring subscriptions.
- **Restore Purchases:** Trigger native receipt refresh and send to backend for validation.
- **Current Plan Visibility:** Display current plan (Free/Pro), renewal date, and status.
- **Manage/Cancel:** Deep link to the iOS App Store or Google Play subscription management page.
- **Offline States:** Cache the last known subscription status locally. If offline, use cached status for UI, but enforce server-side checks for API calls.

## 4. UX Requirements (Settings Screen)
- **Free State:** Show "Free Plan" with a prominent "Upgrade to Pro" CTA. Show current quota usage.
- **Active State:** Show "Pro Plan" badge, next billing date, and "Manage Subscription" secondary button.
- **Expired/Grace Period State:** Show "Pro Plan (Payment Issue)" with a prompt to update payment method.
- **Loading State:** Show skeleton/spinner while fetching status or processing purchase.

## 5. Integration & Behavior Requirements
- **Mobile (Expo):** 
  - Use `expo-in-app-purchases` or `react-native-purchases` (RevenueCat) to handle native billing UI and receipt generation.
  - Store cached entitlement status in local DB/SecureStore.
- **Backend (NestJS):**
  - Endpoint to receive and validate App Store/Play Store receipts.
  - Webhook listener for OS-level subscription events (renewals, cancellations, billing issues).
  - Update user record in Postgres with `subscription_status`, `plan_id`, `expires_at`.
- **Shared (Zod Schemas):**
  - `SubscriptionStatus`: Enum (`FREE`, `ACTIVE`, `PAST_DUE`, `CANCELED`).
  - `PurchaseRequest`: Schema for sending receipt data to backend.
  - `EntitlementResponse`: Schema for backend returning current access level.

## 6. Billing/Provider Assumptions
- **Provider:** Apple App Store and Google Play Store native IAP. 
- **Recommendation:** Use **RevenueCat** for the MVP. It abstracts away App Store/Play Store receipt validation and webhook handling, significantly reducing backend complexity and edge cases.
- **Fallback:** No Stripe web fallback for MVP to strictly comply with App Store guidelines for digital goods.

## 7. Security & Compliance
- **Server Authority:** The mobile app MUST NOT trust local purchase success alone. It must send the receipt to the backend (or RevenueCat), which verifies it with Apple/Google before granting quota.
- **Anti-Tamper:** API endpoints for AI generation must check the backend entitlement state, not a client-provided flag.
- **Privacy:** Clearly link to Terms of Service and Privacy Policy on the paywall screen (required by Apple/Google).

## 8. Analytics & Events
- `paywall_viewed`: User opened the upgrade screen.
- `purchase_started`: User tapped the buy button.
- `purchase_completed`: Receipt successfully validated.
- `purchase_failed`: Native error or validation error.
- `restore_attempted` / `restore_completed`.

## 9. Edge Cases & Error Handling
| Scenario | Handling |
| :--- | :--- |
| Network drops during purchase | OS handles purchase. On next app launch, fetch receipt and sync with backend. |
| Payment declined | Show native OS error. Keep user on Free plan. |
| User cancels via OS settings | Webhook updates backend. App downgrades user at the end of the billing period. |
| Receipt validation fails | Show error: "Could not verify purchase. Please try restoring purchases." |

## 10. Acceptance Criteria
- [ ] Given a Free user, when they navigate to Settings, then they see an "Upgrade to Pro" option.
- [ ] Given a Free user, when they complete a purchase successfully, then the backend validates the receipt and the Settings UI immediately updates to show "Pro Plan".
- [ ] Given a Pro user, when they tap "Manage Subscription", then they are redirected to the OS subscription management screen.
- [ ] Given a user with an active subscription on another device, when they tap "Restore Purchases", then their Pro status is activated on the current device.
- [ ] Given an expired subscription, when the backend receives a cancellation webhook, then the user's status reverts to Free and quotas are enforced.

## 11. Prioritized Backlog
**Epic:** Subscription & Billing MVP

**Tasks:**
1. **[Shared]** Define Zod schemas for subscription status and API payloads. (Size: S)
2. **[Backend]** Integrate RevenueCat SDK / Webhooks for receipt validation and user entitlement updates. (Size: M)
3. **[Mobile]** Implement RevenueCat SDK, fetch offerings, and build the Paywall UI. (Size: M)
4. **[Mobile]** Update Settings screen to reflect Free/Pro states and add Manage/Restore buttons. (Size: S)
5. **[Backend]** Enforce subscription-based AI quotas on generation endpoints. (Size: S)

## 12. Risks, Dependencies & Open Questions
- **Risk:** App Store Review rejection if the paywall lacks required legal text or restore buttons.
- **Dependency:** Requires setting up Apple Developer and Google Play Console accounts, configuring IAP products, and generating API keys for RevenueCat.
- **Open Question:** What are the exact pricing tiers and AI quota limits for Free vs. Pro? (Needs definition before launch).
