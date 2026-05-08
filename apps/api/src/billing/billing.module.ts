import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, RevenueCatWebhookController],
  providers: [BillingService, RevenueCatWebhookService],
  exports: [BillingService],
})
export class BillingModule {}
