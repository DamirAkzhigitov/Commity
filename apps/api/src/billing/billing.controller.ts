import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { GetSubscriptionResponse } from '@personal-assistant/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { SupabaseJwtAuthGuard } from '../auth/supabase-jwt-auth.guard';
import { BillingService } from './billing.service';
import { GooglePlayVerifyDto } from './google-play-verify.dto';

@Controller('billing')
@UseGuards(SupabaseJwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('entitlement')
  getEntitlement(@CurrentUser() user: AuthUser): Promise<GetSubscriptionResponse> {
    return this.billingService.getSubscriptionResponse(user.sub);
  }

  @Post('google-play/verify')
  verifyGooglePlayPurchase(@CurrentUser() user: AuthUser, @Body() body: GooglePlayVerifyDto) {
    return this.billingService.verifyGooglePlayPurchase(user.sub, body.purchaseToken, body.productId);
  }
}
