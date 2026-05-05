import { Injectable } from '@nestjs/common';
import type { Subscription, UserSubscriptionStatus } from '@prisma/client';
import {
  type EntitlementInfo,
  getSubscriptionResponseSchema,
  type GetSubscriptionResponse,
  subscriptionPlans,
  subscriptionStatusSchema,
  type SubscriptionPlan,
} from '@personal-assistant/shared';
import { PrismaService } from '../prisma/prisma.service';

const RC_PROVIDER = 'revenuecat';

export interface Entitlement {
  userId: string;
  plan: SubscriptionPlan;
  active: boolean;
  renewsAt?: string;
  /**
   * When set, monthly chat/token quota counts usage with createdAt >= this instant
   * (UTC). Used for the signup trial window so calendar-month free caps do not apply.
   */
  quotaPeriodStart?: Date;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function hasRevenueCatBackedAccess(
  user: { subscriptionStatus: UserSubscriptionStatus; subscriptionExpiresAt: Date | null },
  now: Date,
): boolean {
  if (!user.subscriptionExpiresAt || user.subscriptionExpiresAt <= now) {
    return false;
  }
  return (
    user.subscriptionStatus === 'ACTIVE' ||
    user.subscriptionStatus === 'PAST_DUE' ||
    user.subscriptionStatus === 'CANCELED'
  );
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

  private latestRcSubscription(subscriptions: Subscription[]): Subscription | undefined {
    return subscriptions
      .filter((s) => s.provider === RC_PROVIDER)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  private async buildPublicEntitlement(userId: string): Promise<EntitlementInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true },
    });
    if (!user) {
      return { status: 'FREE', planId: 'free', expiresAt: null };
    }

    const now = new Date();

    if (hasRevenueCatBackedAccess(user, now)) {
      const rc = this.latestRcSubscription(user.subscriptions);
      const planId = rc ? this.planForProductId(rc.productId).id : subscriptionPlans[1].id;
      const status = subscriptionStatusSchema.parse(user.subscriptionStatus);
      return {
        status,
        planId,
        expiresAt: user.subscriptionExpiresAt!.toISOString(),
      };
    }

    const legacy = user.subscriptions.find(
      (s) =>
        ['active', 'canceled', 'past_due'].includes(s.status) &&
        (!s.currentPeriodEnd || s.currentPeriodEnd > now),
    );
    if (legacy) {
      return {
        status: 'ACTIVE',
        planId: this.planForProductId(legacy.productId).id,
        expiresAt: legacy.currentPeriodEnd?.toISOString() ?? null,
      };
    }

    return { status: 'FREE', planId: 'free', expiresAt: null };
  }

  async getSubscriptionResponse(userId: string): Promise<GetSubscriptionResponse> {
    const entitlement = await this.buildPublicEntitlement(userId);
    return getSubscriptionResponseSchema.parse({ entitlement });
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

    if (hasRevenueCatBackedAccess(user, now)) {
      const rc = this.latestRcSubscription(user.subscriptions);
      const plan = rc ? this.planForProductId(rc.productId) : subscriptionPlans[1];
      return {
        userId,
        plan,
        active: true,
        renewsAt: user.subscriptionExpiresAt!.toISOString(),
      };
    }

    const activeSub = user.subscriptions.find(
      (s) =>
        s.status === 'active' &&
        (!s.currentPeriodEnd || s.currentPeriodEnd > now),
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

    return { userId, plan: freePlan, active: true, quotaPeriodStart: user.createdAt };
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
