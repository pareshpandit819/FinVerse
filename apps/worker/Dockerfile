FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json   ./packages/config/package.json
COPY packages/shared/package.json   ./packages/shared/package.json
COPY packages/db/package.json       ./packages/db/package.json
COPY apps/worker/package.json       ./apps/worker/package.json
RUN pnpm install --frozen-lockfile

# ── builder: generate Prisma client + compile TypeScript ─────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

RUN pnpm --filter @repo/db db:generate
RUN pnpm --filter @repo/worker build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 worker

# Copy compiled output and production node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules     ./node_modules
COPY --from=builder --chown=worker:nodejs /app/packages         ./packages

USER worker
EXPOSE 3001

CMD ["node", "dist/index.js"]
