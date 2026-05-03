/**
 * Deterministic dev/preview seed.
 *
 * Run from `apps/api` via `npm run db:seed`. Idempotent — safe to re-run.
 *
 * Honours `DEV_SEED_USER_ID` (the Supabase auth user UUID) so the User
 * row is keyed to a real Supabase auth user and JWT-protected routes
 * resolve correctly. The Supabase user must exist in the shared dev
 * project; create it once via the Supabase dashboard.
 *
 * Defaults — used only when no env override is provided — match the
 * fixed UUIDs documented in `docs/per-pr-reviewer-flow.md` so reviewers
 * can log in with predictable credentials.
 *
 * IMPORTANT (privacy): never seed real personal data. See
 * `docs/assistant-architecture-guardrails.md`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_USER_ID =
  process.env.DEV_SEED_USER_ID ?? '00000000-0000-4000-8000-000000000001';
const DEFAULT_USER_EMAIL =
  process.env.DEV_SEED_USER_EMAIL ?? 'reviewer@dev.personal-assistant.local';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed script.');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const user = await prisma.user.upsert({
      where: { id: DEFAULT_USER_ID },
      create: { id: DEFAULT_USER_ID, email: DEFAULT_USER_EMAIL },
      update: { email: DEFAULT_USER_EMAIL },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[seed] reviewer user upserted: id=${user.id} email=${user.email ?? '<none>'}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err);
  process.exit(1);
});
