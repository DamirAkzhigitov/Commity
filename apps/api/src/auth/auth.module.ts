import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseJwtAuthGuard } from './supabase-jwt-auth.guard';
import { SupabaseJwtVerifierService } from './supabase-jwt-verifier.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [SupabaseJwtVerifierService, SupabaseJwtAuthGuard],
  exports: [SupabaseJwtVerifierService, SupabaseJwtAuthGuard],
})
export class AuthModule {}
