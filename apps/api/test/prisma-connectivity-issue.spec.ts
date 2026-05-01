import { Prisma } from '@prisma/client';
import { isPrismaConnectivityIssue } from '../src/auth/prisma-connectivity-issue';

describe('isPrismaConnectivityIssue', () => {
  it('returns true for P1001', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P1001',
      clientVersion: 't',
    });
    expect(isPrismaConnectivityIssue(err)).toBe(true);
  });

  it('returns true for PrismaClientInitializationError', () => {
    const err = new Prisma.PrismaClientInitializationError('init', 't');
    expect(isPrismaConnectivityIssue(err)).toBe(true);
  });

  it('returns false for unrelated known errors', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2002',
      clientVersion: 't',
    });
    expect(isPrismaConnectivityIssue(err)).toBe(false);
  });
});
