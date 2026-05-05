import { ForbiddenException } from '@nestjs/common';
import { subscriptionPlans } from '@personal-assistant/shared';
import type { Entitlement } from '../src/billing/billing.service';
import { QuotaPolicyService } from '../src/quota/quota-policy.service';

describe('QuotaPolicyService.assertChatWithinPlanQuota', () => {
  let prisma: {
    usageEvent: { count: jest.Mock; aggregate: jest.Mock };
  };
  let quota: QuotaPolicyService;

  beforeEach(() => {
    prisma = {
      usageEvent: { count: jest.fn(), aggregate: jest.fn() },
    };
    quota = new QuotaPolicyService(prisma as never);
  });

  it('allows when usage is below plan limits for calendar month', async () => {
    prisma.usageEvent.count.mockResolvedValue(0);
    prisma.usageEvent.aggregate.mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } });

    const entitlement: Entitlement = {
      userId: 'u1',
      plan: subscriptionPlans[1],
      active: true,
    };

    await expect(quota.assertChatWithinPlanQuota('u1', entitlement)).resolves.toBeUndefined();
    expect(prisma.usageEvent.count).toHaveBeenCalled();
  });

  it('throws when chat message count reaches plan monthly cap', async () => {
    prisma.usageEvent.count.mockResolvedValue(subscriptionPlans[0].monthlyMessageLimit);
    prisma.usageEvent.aggregate.mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } });

    const entitlement: Entitlement = {
      userId: 'u1',
      plan: subscriptionPlans[0],
      active: true,
    };

    await expect(quota.assertChatWithinPlanQuota('u1', entitlement)).rejects.toThrow(ForbiddenException);
    await expect(quota.assertChatWithinPlanQuota('u1', entitlement)).rejects.toThrow(/quota/i);
  });

  it('uses quotaPeriodStart when provided (trial window)', async () => {
    prisma.usageEvent.count.mockResolvedValue(0);
    prisma.usageEvent.aggregate.mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } });

    const start = new Date('2026-05-01T00:00:00.000Z');
    const entitlement: Entitlement = {
      userId: 'u1',
      plan: subscriptionPlans[0],
      active: true,
      quotaPeriodStart: start,
    };

    await quota.assertChatWithinPlanQuota('u1', entitlement);

    expect(prisma.usageEvent.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: start },
        }),
      }),
    );
  });
});
