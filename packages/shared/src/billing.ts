import { z } from 'zod';

/** Billing / storefront subscription lifecycle (mobile + API). */
export const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'PAST_DUE', 'CANCELED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/** Current entitlement snapshot returned by the backend (non-sensitive). */
export const entitlementInfoSchema = z.object({
  status: subscriptionStatusSchema,
  /** Internal or storefront plan identifier (e.g. mapped from RevenueCat). */
  planId: z.string().min(1).max(128),
  /** ISO 8601 period end; null when not applicable (e.g. FREE). */
  expiresAt: z.string().datetime().nullable(),
});
export type EntitlementInfo = z.infer<typeof entitlementInfoSchema>;

/** GET /billing/entitlement — current subscription snapshot. */
export const getSubscriptionResponseSchema = z.object({
  entitlement: entitlementInfoSchema,
});
export type GetSubscriptionResponse = z.infer<typeof getSubscriptionResponseSchema>;

/** POST /billing/sync — client asks the API to refresh entitlements after IAP / restore. */
export const subscriptionSyncRequestSchema = z.object({
  platform: z.enum(['ios', 'android']),
});
export type SubscriptionSyncRequest = z.infer<typeof subscriptionSyncRequestSchema>;

export const subscriptionSyncResponseSchema = z.object({
  entitlement: entitlementInfoSchema,
});
export type SubscriptionSyncResponse = z.infer<typeof subscriptionSyncResponseSchema>;
