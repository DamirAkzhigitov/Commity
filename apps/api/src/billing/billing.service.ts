import { Injectable } from '@nestjs/common';
import { type SubscriptionPlan, subscriptionPlans } from '@personal-assistant/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface Entitlement {
  userId: string;
  plan: SubscriptionPlan;
  active: boolean;
  renewsAt?: string;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private planForProductId(productId: string): SubscriptionPlan {
    const id = productId.toLowerCase();
    if (id.includes('pro')) {
      return subscriptionPlans.find((p) => p.id === 'pro')!;
    }
    if (id.includes('plus')) {
      return subscriptionPlans.find((p) => p.id === 'plus')!;
    }
    return subscriptionPlans.find((p) => p.id === 'plus')!;
  }

  async getEntitlement(userId: string): Promise<Entitlement> {
    const freePlan = subscriptionPlans[0];
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });
    if (!user) {
      return { userId, plan: freePlan, active: false };
    }

    const now = new Date();
    const activeSub = user.subscriptions.find(
      (s) => s.status === 'active' && (!s.currentPeriodEnd || s.currentPeriodEnd > now),
    );

    if (activeSub) {
      const plan = this.planForProductId(activeSub.productId);
      return {
        userId,
        plan,
        active: true,
        renewsAt: activeSub.currentPeriodEnd?.toISOString(),
      };
    }

    const trialEnd = addUtcDays(user.createdAt, 3);
    if (now > trialEnd) {
      return { userId, plan: freePlan, active: false };
    }

    const trialMessages = await this.prisma.usageEvent.count({
      where: {
        userId,
        feature: 'chat',
        createdAt: { gte: user.createdAt },
      },
    });

    if (trialMessages >= 25) {
      return { userId, plan: freePlan, active: false };
    }

    return { userId, plan: freePlan, active: true };
  }

  async verifyGooglePlayPurchase(userId: string, purchaseToken: string, productId: string) {
    // Replace with Android Publisher API verification before accepting real payments.
    return {
      userId,
      productId,
      purchaseToken,
      verified: false,
      reason: 'Google Play verification is not configured yet.',
    };
  }
}
