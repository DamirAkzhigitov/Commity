# AGENTS Guidance

## Documentation Start Point
Before making product or architecture decisions, start from:

- `docs/assistant-docs-index.md`

This index links to core assistant contracts, guardrails, milestone acceptance criteria, and all product planning documents (requirements, epics, and tasks).

## Working Rule
- Treat `docs/assistant-docs-index.md` as the canonical navigation hub for documentation discovery.
- When updating assistant contracts or behavior, update linked docs in the same change set as needed.

## Cursor Cloud specific instructions

### Monorepo layout
Three npm workspaces: `apps/api` (NestJS), `apps/mobile` (Expo/React Native), `packages/shared` (Zod schemas). Root `package.json` has convenience scripts — see its `"scripts"` section.

### Prerequisites (handled by the update script)
- Node >= 22 (via nvm)
- `npm install` at repo root
- Prisma client generated (`npm run prisma:generate`)
- Shared package built (`npm run build -w @personal-assistant/shared`)

### Starting PostgreSQL
Docker is required. From the repo root:
```
dockerd &>/var/log/dockerd.log &   # if daemon not already running
docker compose up -d postgres
```
Wait for the healthcheck to pass before running migrations.

### Database migrations
From `apps/api`: `npx prisma migrate deploy`. This uses `DATABASE_URL` from `apps/api/.env`.

### Running the API
1. Ensure `apps/api/.env` exists (copy from `.env.example`; defaults work with docker-compose Postgres).
2. `npm run dev:api` from the repo root (or `npm run start:dev` from `apps/api`).
3. Health check: `GET http://localhost:3000/health` (no auth required).
4. Protected routes need a Supabase JWT. Without real Supabase credentials, only `/health` and tests will work.

### Running tests
| Scope | Command (from repo root) |
|---|---|
| Shared (vitest) | `npm test -w @personal-assistant/shared` |
| API unit (jest) | `npm test -w @personal-assistant/api` |
| API e2e (jest) | `cd apps/api && npm run test:e2e` (needs Postgres running + migrations applied) |
| Mobile (vitest) | `npm test -w @personal-assistant/mobile` |
| Typecheck all | `npm run typecheck` |

### Gotchas
- No ESLint or dedicated lint scripts exist; `npm run typecheck` is the static analysis gate.
- The API uses mock assistant responses when `OPENAI_API_KEY` is omitted from `apps/api/.env`.
- Supabase is an external SaaS dependency for auth. Without real `SUPABASE_URL` / keys, JWT-protected endpoints return 401 — this is expected. Tests mock the auth layer.
- The mobile app (`apps/mobile`) requires an Android emulator or physical device and Expo Go; it cannot be tested headlessly in this cloud environment. Mobile unit tests run fine via vitest.
- The `@personal-assistant/shared` package must be **built** (`npm run build -w @personal-assistant/shared`) before the API or its tests can resolve it, because the API's `tsconfig` references `dist/`.
