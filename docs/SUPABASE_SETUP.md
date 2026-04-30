# Supabase Setup

This project uses Supabase Auth JWT verification in the API. Use these defaults when creating the Supabase database for MVP:

- Enable Data API: `OFF`
- Automatically expose new tables and functions: `OFF`
- Enable automatic RLS: `ON`

## Why these defaults

- `Data API OFF` keeps PostgREST/GraphQL data endpoints disabled when the app is backend-first.
- `Auto expose OFF` prevents newly created tables/functions from being exposed accidentally.
- `Automatic RLS ON` adds a deny-by-default posture for new tables.

## Verify project settings (Dashboard)

1. Open Supabase Dashboard -> Project Settings -> Data API.
2. Confirm Data API is disabled.
3. Confirm automatic exposure for new tables/functions is disabled.
4. Confirm automatic RLS for new public tables is enabled.

## Environment setup

Set API environment values in `apps/api/.env`:

- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_JWT_AUD=authenticated` (default expected by backend)
- `DATABASE_URL=postgresql://...` (Supabase Postgres connection string)

Do not put service-role keys in mobile clients.

## Apply baseline hardening

- Preferred: run Prisma migrations, which now include infra-only schema alignment and RLS hardening.
- Optional/manual: run `docs/sql/supabase-baseline-security.sql` in Supabase SQL Editor after schema creation/migrations.

## Post-setup checklist

- JWT auth works against Supabase-issued access tokens.
- `GET /health` is public, protected endpoints reject missing/invalid JWT.
- API writes only infrastructure data for this MVP phase.
- No personal message content is stored in usage tables or logs.
- New DB tables are created with RLS enabled and explicit policies.
