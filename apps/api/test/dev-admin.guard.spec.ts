import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DevAdminGuard } from '../src/dev-admin/dev-admin.guard';

function contextWithHeader(secret?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'x-dev-admin-secret': secret,
        },
      }),
    }),
  };
}

describe('DevAdminGuard', () => {
  it('blocks production env', () => {
    const config = { get: jest.fn((k: string) => (k === 'NODE_ENV' ? 'production' : undefined)) };
    const guard = new DevAdminGuard(config as never);
    expect(() => guard.canActivate(contextWithHeader('x') as never)).toThrow(ForbiddenException);
  });

  it('fails if DEV_ADMIN_SECRET is missing', () => {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };
    const guard = new DevAdminGuard(config as never);
    expect(() => guard.canActivate(contextWithHeader('x') as never)).toThrow(ServiceUnavailableException);
  });

  it('fails on wrong secret', () => {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'NODE_ENV') return 'development';
        if (k === 'DEV_ADMIN_SECRET') return 'expected';
        return undefined;
      }),
    };
    const guard = new DevAdminGuard(config as never);
    expect(() => guard.canActivate(contextWithHeader('wrong') as never)).toThrow(UnauthorizedException);
  });

  it('passes on valid secret in non-production', () => {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'NODE_ENV') return 'test';
        if (k === 'DEV_ADMIN_SECRET') return 'expected';
        return undefined;
      }),
    };
    const guard = new DevAdminGuard(config as never);
    expect(guard.canActivate(contextWithHeader('expected') as never)).toBe(true);
  });
});
