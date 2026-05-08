# Dev admin: test users and subscription state

Use these API routes to **create, update, delete** `User` rows and to **toggle subscription fields** (`subscriptionStatus`, `subscriptionExpiresAt`) in **non-production** environments.

## Safety

- **Disabled when `NODE_ENV=production`** (returns `403`).
- Requires **`DEV_ADMIN_SECRET`** in `apps/api/.env` (or deployment env).
- Every request must send header **`x-dev-admin-secret`** with the same value (timing-safe compare).

Do **not** set `DEV_ADMIN_SECRET` in production deployments.

## Configuration

In `apps/api/.env` (see `apps/api/.env.example`):

- `DEV_ADMIN_SECRET` — shared secret for dev-admin requests.

## Endpoints

Base path: `/dev-admin/users`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/dev-admin/users` | Create user |
| `PATCH` | `/dev-admin/users/:userId` | Update user (email) |
| `DELETE` | `/dev-admin/users/:userId` | Delete user |
| `POST` | `/dev-admin/users/:userId/subscription` | Set subscription status + expiration |

### Create user

Body:

```json
{ "id": "qa_user_1", "email": "qa1@example.com" }
```

`id` is required and should match the **Supabase JWT `sub`** for that tester if you want normal auth flows to hit the same row (the auth guard upserts by `sub`).

`email` is optional; use `null` to clear if provided.

### Update user

Body (at least one field when extending later; today supports `email`):

```json
{ "email": "qa+updated@example.com" }
```

or

```json
{ "email": null }
```

### Set subscription

Body:

```json
{
  "status": "FREE",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

- `status`: one of `FREE`, `ACTIVE`, `PAST_DUE`, `CANCELED` (shared `SubscriptionStatus` enum).
- `expiresAt`: ISO 8601 datetime string, or `null` (e.g. for `FREE`).

## Examples (`curl`)

Replace `API_URL` and `DEV_ADMIN_SECRET`.

```bash
export API_URL=http://localhost:3000
export DEV_ADMIN_SECRET=your-local-secret

curl -sS -X POST "$API_URL/dev-admin/users" \
  -H "Content-Type: application/json" \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -d '{"id":"qa_active_user","email":"qa@example.com"}'

curl -sS -X POST "$API_URL/dev-admin/users/qa_active_user/subscription" \
  -H "Content-Type: application/json" \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -d '{"status":"ACTIVE","expiresAt":"2026-12-31T23:59:59.000Z"}'

curl -sS -X POST "$API_URL/dev-admin/users/qa_active_user/subscription" \
  -H "Content-Type: application/json" \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -d '{"status":"FREE","expiresAt":null}'

curl -sS -X PATCH "$API_URL/dev-admin/users/qa_active_user" \
  -H "Content-Type: application/json" \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -d '{"email":"qa+updated@example.com"}'

curl -sS -X DELETE "$API_URL/dev-admin/users/qa_active_user" \
  -H "x-dev-admin-secret: $DEV_ADMIN_SECRET"
```

## Verify entitlement

After changing subscription fields, call the normal authenticated endpoint:

- `GET /billing/entitlement` (requires a valid Supabase JWT for the same `userId` / `sub`).

## Implementation reference

- Nest module: `apps/api/src/dev-admin/`
- Guard: `apps/api/src/dev-admin/dev-admin.guard.ts`
