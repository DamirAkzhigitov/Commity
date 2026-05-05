# Task: Backend Quota Enforcement

## User Story
As a system, I need to enforce different AI usage limits based on subscription status so that the business model is viable.

## Scope
- In: Rate limiting / quota checking logic in the AI generation endpoints based on the user's `subscription_status`.
- Out: Complex token counting (MVP can use simple request counts if token counting is too complex).

## Acceptance Criteria
- [x] Given a Free user, when they exceed the free daily/monthly quota, then the API returns a 403/429 error indicating quota exceeded.
- [x] Given a Pro user, when they make requests, then they are allowed up to the Pro quota limit.

## Implementation Notes
- Backend: Implement a guard or interceptor in NestJS that checks usage against the user's plan limits before calling the LLM.
