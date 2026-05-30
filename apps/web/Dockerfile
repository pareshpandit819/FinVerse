FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# ── deps: install all workspace dependencies ────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json       ./packages/config/package.json
COPY packages/shared/package.json       ./packages/shared/package.json
COPY packages/ui/package.json           ./packages/ui/package.json
COPY packages/db/package.json           ./packages/db/package.json
COPY apps/web/package.json              ./apps/web/package.json
RUN pnpm install --frozen-lockfile

# ── builder: generate Prisma client + build Next.js ─────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Prisma generate needs the schema
RUN pnpm --filter @repo/db db:generate

# Build args for public env vars that must be baked at build time
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_APP_URL

ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy secret so Next.js auth doesn't abort the build
ENV AUTH_SECRET=build-placeholder
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

RUN pnpm --filter @repo/web build

# ── runner: minimal production image ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output (requires `output: 'standalone'` in next.config)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public            ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
