import { Injectable } from '@nestjs/common';
import { subscriptionPlans, type SubscriptionPlan } from '@personal-assistant/shared';

export interface Entitlement {
  userId: string;
  plan: SubscriptionPlan;
  active: boolean;
  renewsAt?: string;
}

@Injectable()
export class BillingService {
  getEntitlement(userId: string): Entitlement {
    return {
      userId,
      plan: subscriptionPlans[0],
      active: true,
    };
  }

  verifyGooglePlayPurchase(userId: string, purchaseToken: string, productId: string) {
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
