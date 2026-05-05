import { describe, expect, it } from 'vitest';
import {
  entitlementInfoSchema,
  getSubscriptionResponseSchema,
  subscriptionStatusSchema,
  subscriptionSyncRequestSchema,
  subscriptionSyncResponseSchema,
} from './billing.js';

describe('subscriptionStatusSchema', () => {
  it('accepts all lifecycle values', () => {
    for (const v of ['FREE', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const) {
      expect(subscriptionStatusSchema.parse(v)).toBe(v);
    }
  });
});

describe('entitlementInfoSchema', () => {
  it('parses ACTIVE with expiration', () => {
    const out = entitlementInfoSchema.parse({
      status: 'ACTIVE',
      planId: 'plus',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    expect(out.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });

  it('allows null expiresAt for FREE', () => {
    const out = entitlementInfoSchema.parse({
      status: 'FREE',
      planId: 'free',
      expiresAt: null,
    });
    expect(out.expiresAt).toBeNull();
  });
});

describe('subscription API wire schemas', () => {
  it('parses get subscription response', () => {
    const body = {
      entitlement: {
        status: 'PAST_DUE' as const,
        planId: 'pro',
        expiresAt: '2026-06-01T12:00:00.000Z',
      },
    };
    expect(() => getSubscriptionResponseSchema.parse(body)).not.toThrow();
  });

  it('parses sync request + response', () => {
    subscriptionSyncRequestSchema.parse({ platform: 'ios' });
    subscriptionSyncResponseSchema.parse({
      entitlement: {
        status: 'CANCELED',
        planId: 'plus',
        expiresAt: null,
      },
    });
  });
});
