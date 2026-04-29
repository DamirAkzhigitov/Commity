import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('entitlement')
  getEntitlement(@Query('userId') userId = 'demo-user') {
    return this.billingService.getEntitlement(userId);
  }

  @Post('google-play/verify')
  verifyGooglePlayPurchase(
    @Body()
    body: {
      userId?: string;
      purchaseToken: string;
      productId: string;
    },
  ) {
    return this.billingService.verifyGooglePlayPurchase(
      body.userId ?? 'demo-user',
      body.purchaseToken,
      body.productId,
    );
  }
}
