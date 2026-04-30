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
   * Enforces plan monthly caps for subscribed users. Trial-only users rely on BillingService
   * for trial caps; this is a no-op when there is no active subscription.
   */
  async assertSubscribedChatWithinQuota(userId: string, entitlement: Entitlement): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });
    if (!user) {
      throw new ForbiddenException('User not found.');
    }
    const now = new Date();
    const activeSub = user.subscriptions.find(
      (s) => s.status === 'active' && (!s.currentPeriodEnd || s.currentPeriodEnd > now),
    );
    if (!activeSub) {
      return;
    }

    const plan: SubscriptionPlan = entitlement.plan;
    const periodStart = startOfUtcMonth(now);

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
