import { ForbiddenException, Injectable } from '@nestjs/common';
import { type SubscriptionPlan } from '@personal-assistant/shared';
import type { Entitlement } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

@Injectable()
export class QuotaPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforces plan monthly chat/token caps for every active entitlement (free trial,
   * free plan, or paid). Subscribed users use a calendar UTC month window; trial users
   * use {@link Entitlement.quotaPeriodStart} when provided.
   */
  async assertChatWithinPlanQuota(userId: string, entitlement: Entitlement): Promise<void> {
    const plan: SubscriptionPlan = entitlement.plan;
    const periodStart = entitlement.quotaPeriodStart ?? startOfUtcMonth(new Date());

    const messageCount = await this.prisma.usageEvent.count({
      where: {
        userId,
        feature: 'chat',
        createdAt: { gte: periodStart },
      },
    });

    if (messageCount >= plan.monthlyMessageLimit) {
      throw new ForbiddenException('Monthly message quota exceeded.');
    }

    const tokenAgg = await this.prisma.usageEvent.aggregate({
      where: { userId, createdAt: { gte: periodStart } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    const tokens =
      (tokenAgg._sum.inputTokens ?? 0) + (tokenAgg._sum.outputTokens ?? 0);
    if (tokens >= plan.monthlyTokenLimit) {
      throw new ForbiddenException('Monthly token quota exceeded.');
    }
  }
}
