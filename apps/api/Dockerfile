# Multi-stage Dockerfile for apps/api.
#
# Built from the **monorepo root** (the Railway service is configured with
# `Root Directory = /` and `Dockerfile Path = apps/api/Dockerfile`) so that
# we can install workspace dependencies, build @personal-assistant/shared
# (apps/api/tsconfig references its dist/), and run `nest build` against
# the resulting tree.

# ---------- builder ----------
FROM node:22.14.0-bookworm-slim AS builder

WORKDIR /repo

ENV CI=1
ENV HUSKY=0

# Install OS deps required by Prisma's bundled OpenSSL + node-gyp targets.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first to maximise layer cache reuse.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --include=dev --workspaces --include-workspace-root

# Copy the rest of the sources.
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build the shared package first (apps/api/tsconfig references its dist/).
RUN npm run build -w @personal-assistant/shared

# Generate Prisma client (uses apps/api/prisma/schema.prisma).
RUN npm run prisma:generate -w @personal-assistant/api

# Compile NestJS to dist/.
RUN npm run build -w @personal-assistant/api

# Drop dev deps for a smaller runtime layer.
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---------- runtime ----------
FROM node:22.14.0-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=3000

# Prisma needs OpenSSL at runtime as well.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

# Copy only what the runtime needs.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/package-lock.json ./package-lock.json

COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma

COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist

# Non-root for safety.
RUN useradd -r -u 1001 -g nogroup nodeapp \
    && chown -R nodeapp:nogroup /app
USER nodeapp

EXPOSE 3000

# Honour Railway's $PORT if set, fall back to API_PORT.
ENV API_PORT=3000

ENTRYPOINT ["/usr/bin/tini", "--"]

# Migrations and seeding run as separate steps from the preview workflow
# (npx prisma migrate deploy / npm run db:seed) so this image only needs
# the Nest runtime. @prisma/client is required and was installed above.
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
