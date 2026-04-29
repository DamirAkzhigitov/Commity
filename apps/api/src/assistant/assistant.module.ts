import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { UsageModule } from '../usage/usage.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [BillingModule, UsageModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
