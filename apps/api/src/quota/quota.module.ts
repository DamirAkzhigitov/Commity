import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaPolicyService } from './quota-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [QuotaPolicyService],
  exports: [QuotaPolicyService],
})
export class QuotaModule {}
