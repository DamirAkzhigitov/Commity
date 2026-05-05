import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { UserSubscriptionStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { verifyRevenueCatSignature } from './revenuecat-signature';

const RC_PROVIDER = 'revenuecat';

const revenueCatWebhookBodySchema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string().optional(),
    product_id: z.string().optional(),
    expiration_at_ms: z.number().nullable().optional(),
  }),
});

export type RevenueCatWebhookBody = z.infer<typeof revenueCatWebhookBodySchema>;

function timingSafeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

function expirationDate(ms: number | null | undefined): Date | null {
  if (ms == null || ms <= 0) return null;
  return new Date(ms);
}

@Injectable()
export class RevenueCatWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  verifyRequest(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): void {
    const secret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    const authExpected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTHORIZATION');
    if (!secret) {
      throw new ServiceUnavailableException(
        'RevenueCat webhook secret is not configured (REVENUECAT_WEBHOOK_SECRET).',
      );
    }
    const sig = headerValue(headers['x-revenuecat-signature']);
    if (!verifyRevenueCatSignature(rawBody, sig, secret)) {
      throw new UnauthorizedException('Invalid RevenueCat webhook signature.');
    }
    if (authExpected) {
      const auth = headerValue(headers.authorization);
      if (!auth || !timingSafeEqualUtf8(auth, authExpected)) {
        throw new UnauthorizedException('Invalid webhook authorization header.');
      }
    }
  }

  async handlePayload(payload: unknown): Promise<void> {
    const parsed = revenueCatWebhookBodySchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException('Malformed RevenueCat webhook payload.');
    }
    await this.applyEvent(parsed.data);
  }

  private async applyEvent(body: RevenueCatWebhookBody): Promise<void> {
    const ev = body.event;
    const userId = ev.app_user_id;
    if (!userId || ev.type === 'TEST') {
      return;
    }

    const exp = expirationDate(ev.expiration_at_ms ?? null);
    const now = new Date();
    const productId = ev.product_id;

    switch (ev.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'SUBSCRIPTION_EXTENDED':
      case 'NON_RENEWING_PURCHASE':
      case 'TEMPORARY_ENTITLEMENT_GRANT':
      case 'PRODUCT_CHANGE':
        await this.setUserSubscription(userId, exp, now, productId, 'ACTIVE', 'active');
        break;
      case 'CANCELLATION':
        await this.setUserSubscription(userId, exp, now, productId, 'ACTIVE', 'canceled');
        break;
      case 'BILLING_ISSUE':
        await this.setUserSubscription(userId, exp, now, productId, 'PAST_DUE', 'past_due');
        break;
      case 'EXPIRATION':
        await this.prisma.user.updateMany({
          where: { id: userId },
          data: {
            subscriptionStatus: 'FREE',
            subscriptionExpiresAt: null,
          },
        });
        if (productId) {
          await this.syncRcSubscriptionRow(userId, productId, exp ?? now, 'expired');
        }
        break;
      default:
        break;
    }
  }

  private async setUserSubscription(
    userId: string,
    exp: Date | null,
    now: Date,
    productId: string | undefined,
    statusWhenActive: UserSubscriptionStatus,
    rowStatus: string,
  ): Promise<void> {
    const active = exp != null && exp > now;
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        subscriptionStatus: active ? statusWhenActive : 'FREE',
        subscriptionExpiresAt: active ? exp : null,
      },
    });
    if (active && productId) {
      await this.syncRcSubscriptionRow(userId, productId, exp, rowStatus);
    }
  }

  private async syncRcSubscriptionRow(
    userId: string,
    productId: string,
    currentPeriodEnd: Date | null,
    status: string,
  ): Promise<void> {
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, provider: RC_PROVIDER },
      orderBy: { updatedAt: 'desc' },
    });
    const data = {
      productId,
      status,
      currentPeriodEnd,
    };
    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          userId,
          provider: RC_PROVIDER,
          productId,
          status,
          currentPeriodEnd,
        },
      });
    }
  }
}
