import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseJwtVerifierService } from './supabase-jwt-verifier.service';

@Injectable()
export class SupabaseJwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: SupabaseJwtVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: { sub: string; email?: string } }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const payload = await this.verifier.verifyJwt(token);
    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub) {
      throw new UnauthorizedException('Token subject is missing.');
    }
    const email = typeof payload.email === 'string' ? payload.email : undefined;

    await this.prisma.user.upsert({
      where: { id: sub },
      create: { id: sub, email: email ?? null },
      update: email ? { email } : {},
    });

    request.user = { sub, email };
    return true;
  }
}
