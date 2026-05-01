import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseJwtAuthGuard } from '../src/auth/supabase-jwt-auth.guard';
import { SupabaseJwtVerifierService } from '../src/auth/supabase-jwt-verifier.service';

describe('SupabaseJwtAuthGuard', () => {
  const createContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: authHeader !== undefined ? { authorization: authHeader } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  it('maps Prisma connectivity errors to ServiceUnavailableException', async () => {
    const verifier = {
      verifyJwt: jest.fn().mockResolvedValue({ sub: 'user-1', email: 'a@ex.com' }),
    } as unknown as SupabaseJwtVerifierService;
    const prisma = {
      user: {
        upsert: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unreachable', {
            code: 'P1001',
            clientVersion: 'test',
          }),
        ),
      },
    } as unknown as PrismaService;

    const guard = new SupabaseJwtAuthGuard(verifier, prisma);
    await expect(
      guard.canActivate(createContext('Bearer fake.jwt')),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(verifier.verifyJwt).toHaveBeenCalled();
  });

  it('rethrows non-connectivity Prisma errors', async () => {
    const verifier = {
      verifyJwt: jest.fn().mockResolvedValue({ sub: 'user-1' }),
    } as unknown as SupabaseJwtVerifierService;
    const constraint = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = {
      user: { upsert: jest.fn().mockRejectedValue(constraint) },
    } as unknown as PrismaService;

    const guard = new SupabaseJwtAuthGuard(verifier, prisma);
    await expect(guard.canActivate(createContext('Bearer fake.jwt'))).rejects.toBe(constraint);
  });

  it('still returns 401 for missing bearer token', async () => {
    const verifier = { verifyJwt: jest.fn() } as unknown as SupabaseJwtVerifierService;
    const prisma = { user: { upsert: jest.fn() } } as unknown as PrismaService;
    const guard = new SupabaseJwtAuthGuard(verifier, prisma);
    await expect(guard.canActivate(createContext())).rejects.toThrow(UnauthorizedException);
    expect(verifier.verifyJwt).not.toHaveBeenCalled();
  });
});
