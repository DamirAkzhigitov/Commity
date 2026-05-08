import { BillingService } from '../src/billing/billing.service';

describe('BillingService.getSubscriptionResponse', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    usageEvent: { count: jest.Mock };
  };
  let billing: BillingService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      usageEvent: { count: jest.fn() },
    };
    billing = new BillingService(prisma as never);
  });

  it('returns FREE entitlement when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(billing.getSubscriptionResponse('missing')).resolves.toEqual({
      entitlement: { status: 'FREE', planId: 'free', expiresAt: null },
    });
  });

  it('maps RevenueCat-backed user row plus RC subscription product to shared snapshot', async () => {
    const exp = new Date(Date.now() + 86_400_000);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: exp,
      subscriptions: [
        {
          provider: 'revenuecat',
          productId: 'monthly_plus',
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    const res = await billing.getSubscriptionResponse('u1');
    expect(res.entitlement).toEqual({
      status: 'ACTIVE',
      planId: 'plus',
      expiresAt: exp.toISOString(),
    });
  });

  it('uses legacy subscription rows when User subscription fields are not active', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      subscriptionStatus: 'FREE',
      subscriptionExpiresAt: null,
      subscriptions: [
        {
          provider: 'google_play',
          productId: 'annual_pro',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 60_000),
          updatedAt: new Date(),
        },
      ],
    });

    const res = await billing.getSubscriptionResponse('u2');
    expect(res.entitlement.status).toBe('ACTIVE');
    expect(res.entitlement.planId).toBe('pro');
    expect(res.entitlement.expiresAt).toBeDefined();
  });
});
