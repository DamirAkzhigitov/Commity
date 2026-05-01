import { Prisma } from '@prisma/client';

/** Prisma error codes for transient or configuration-related DB reachability. */
const CONNECTIVITY_KNOWN_CODES = new Set(['P1001', 'P1002', 'P1017']);

export function isPrismaConnectivityIssue(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return CONNECTIVITY_KNOWN_CODES.has(error.code);
  }
  return false;
}
