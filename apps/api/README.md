# Personal Assistant API

## Local setup

1. Start Postgres (from repo root). The Compose file uses a `pgvector` image because the schema includes `vector` columns.

   ```bash
   docker compose up -d
   ```

   If a migration previously failed (e.g. `type "vector" does not exist` on vanilla Postgres), mark it rolled back, then re-deploy after switching images:

   ```bash
   cd apps/api
   npx prisma migrate resolve --rolled-back "20250430120000_init"
   npx prisma migrate deploy
   ```

   To fully reset the local DB volume: `docker compose down -v && docker compose up -d`, then `npx prisma migrate deploy` from `apps/api`.

2. Copy env template and set real Supabase values:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. Apply migrations and run:

   ```bash
   cd apps/api
   npx prisma migrate deploy
   npm run prisma:generate
   npm run start:dev
   ```

- Health check (no auth): `GET http://localhost:3000/health`
- Protected routes require `Authorization: Bearer <Supabase access token>`.

## Tests

- Unit tests (no database): `npm test`
- Integration / HTTP tests: start Postgres, run `npx prisma migrate deploy` in `apps/api`, then `npm run test:e2e`
