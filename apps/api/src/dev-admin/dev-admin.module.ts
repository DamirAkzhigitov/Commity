import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DevAdminController } from './dev-admin.controller';
import { DevAdminGuard } from './dev-admin.guard';
import { DevAdminService } from './dev-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [DevAdminController],
  providers: [DevAdminGuard, DevAdminService],
})
export class DevAdminModule {}
