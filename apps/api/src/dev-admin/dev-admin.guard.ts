import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

@Injectable()
export class DevAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const env = (this.config.get<string>('NODE_ENV') ?? 'development').toLowerCase();
    if (env === 'production') {
      throw new ForbiddenException('Dev admin endpoints are disabled in production.');
    }

    const secret = this.config.get<string>('DEV_ADMIN_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException(
        'Dev admin secret is not configured (DEV_ADMIN_SECRET).',
      );
    }

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-dev-admin-secret'];
    if (!provided || !safeEqual(provided, secret)) {
      throw new UnauthorizedException('Invalid dev admin secret.');
    }
    return true;
  }
}
