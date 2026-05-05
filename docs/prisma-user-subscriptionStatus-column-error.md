# Prisma: `User.subscriptionStatus` column does not exist

This document records the investigation and fix for a runtime error where the API’s Prisma client expected subscription columns on `User`, but the connected database had not applied the migration that adds them.

## Symptom

Nest logs showed an unhandled assistant error during JWT auth when upserting the user:

- **Error**: `PrismaClientKnownRequestError` — invalid `prisma.user.upsert()` invocation.
- **Message**: The column `subscriptionStatus` of relation `User` does not exist in the current database.
- **Location (compiled)**: `apps/api/dist/.../auth/supabase-jwt-auth.guard.js` (stack traces pointing at `dist/` are normal for Nest builds).

## Root cause

**Schema/database drift**, not a missing migration file in the repository.

- `User.subscriptionStatus` and related fields exist in `schema.prisma`.
- Migration **`20260505140000_user_subscription_revenuecat`** in the repo adds the enum and columns.
- The database Prisma was using had **not** applied that migration yet.
- The generated Prisma Client matches the schema, so `upsert()` emitted SQL referencing columns the DB did not have → Prisma **P2022**-style “column does not exist”.

## Fix (local / any environment)

Apply pending migrations against the database identified by `DATABASE_URL` (e.g. `apps/api/.env`).

From repo root, typical flow:

1. Ensure Postgres is running and `DATABASE_URL` points at the intended DB.
2. From `apps/api`:

   ```bash
   npx prisma migrate status
   npx prisma migrate deploy
   npx prisma migrate status
   ```

3. Regenerate the client and rebuild so tooling stays aligned:

   ```bash
   npm run prisma:generate
   npm run build -w @personal-assistant/api
   ```

**Migration file in repo**: `apps/api/prisma/migrations/20260505140000_user_subscription_revenuecat/migration.sql`

## Verification performed (example)

| Step | Result |
|------|--------|
| `npx prisma migrate status` | One pending migration: `20260505140000_user_subscription_revenuecat` |
| `npx prisma migrate deploy` | Migration applied successfully |
| `npx prisma migrate status` | Database schema up to date |
| `npm run prisma:generate` | Client regenerated |
| `npm run build -w @personal-assistant/api` | Build succeeded |
| `npm run typecheck` | Succeeded |
| `npm test -w @personal-assistant/api -- --testPathPatterns=billing` | Billing-related tests passed |

## Follow-up (environment-dependent)

- **Staging / production / Supabase**: Run `prisma migrate deploy` (or your pipeline equivalent) with that environment’s `DATABASE_URL`. Until then, the same error can appear there.
- **After pulling a branch with new migrations**: Run `migrate deploy` before starting the API so the DB never lags the schema.
- **Stale `dist` alone** does not cause “column does not exist” if the DB is current; that symptom almost always means the **database** is behind the Prisma schema.

## Related product context

Subscription work is tracked under product docs such as `docs/product/epics/subscription-billing.md` and related subscription tasks; this note is operational/runbook detail for the migration mismatch class of failure.
