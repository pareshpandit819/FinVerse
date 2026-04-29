# Running the Enterprise Financial Dashboard — Step-by-Step Guide

This guide covers everything you need to get the dashboard running locally from this repository, including all the quirks of the current setup.

---

## Prerequisites

You need the following tools installed before starting:

| Tool | Required Version | How to Check |
|------|-----------------|--------------|
| Node.js | ≥ 20 | `node --version` |
| pnpm | ≥ 9 | `pnpm --version` |
| Docker + Compose | ≥ 24 | `docker --version` |
| make | any | `make --version` |

**On this machine specifically:** Node.js and pnpm are managed by `nvm`, and Docker is managed by Colima. Both binaries live in `~/bin/`. You must source nvm and add `~/bin` to your PATH in every new terminal session:

```bash
source ~/.nvm/nvm.sh
export PATH="$HOME/bin:$PATH"
```

To make this permanent, add both lines to `~/.zshrc`.

---

## Step 1 — Start Docker (Colima)

This machine uses Colima as the Docker runtime instead of Docker Desktop. Check its status first:

```bash
export PATH="$HOME/bin:$PATH"
colima status
```

If it shows `colima is running`, you can skip ahead. If not:

```bash
colima start
```

Wait about 30 seconds for the VM to boot. Verify Docker is working:

```bash
docker ps
# Should return an empty table, not an error
```

---

## Step 2 — Wipe Previous Infrastructure (Clean Slate)

If you have run this project before and want a completely fresh start (new database, fresh volumes):

```bash
cd /Users/prachi/enterprise-financial-dashboard
docker compose down -v
```

This removes all containers **and** the named volumes (`postgres_data`, `redis_data`). All previous database data is erased. Skip this step if you want to keep existing data.

---

## Step 3 — Install Dependencies

```bash
cd /Users/prachi/enterprise-financial-dashboard
source ~/.nvm/nvm.sh
pnpm install
```

This installs all dependencies for every workspace (web app, worker, all packages) in one command. The lockfile is committed, so this is deterministic.

---

## Step 4 — Start Infrastructure Services

```bash
export PATH="$HOME/bin:$PATH"
docker compose up -d
```

This starts three services in the background:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Primary database |
| Redis 7 | 6379 | Job queue and rate limiter |
| Mailhog | 1025 (SMTP), 8025 (Web UI) | Email capture for local dev |

Wait for all three to be healthy:

```bash
docker compose ps
# All three should show "healthy" in the Status column
```

---

## Step 5 — Configure Environment Variables

The `.env` file already exists at the repo root with development defaults. Most values are pre-filled. Open it and check:

```bash
cat .env | grep -v "^#" | grep -v "^$"
```

The following values are already set for local development:
- `DATABASE_URL` and `DIRECT_URL` — points to local Postgres
- `REDIS_URL` and `REDIS_PASSWORD` — points to local Redis
- `AUTH_SECRET` and `NEXTAUTH_SECRET` — random string for session signing
- `PLAID_TOKEN_ENCRYPTION_KEY` and `MFA_SECRET_ENCRYPTION_KEY` — AES-256 keys

The following are **optional** for basic functionality (the app runs without them, features just won't work):
- `PLAID_CLIENT_ID` / `PLAID_SECRET` — required for connecting real bank accounts
- `ANTHROPIC_API_KEY` — required for AI insights generation
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required for Google sign-in

To generate new encryption keys if needed:
```bash
openssl rand -hex 32
```

---

## Step 6 — Run Database Migrations

```bash
source ~/.nvm/nvm.sh
pnpm --filter @repo/db db:migrate:deploy
```

This applies all Prisma migrations to the local database, creating all tables, indexes, Row-Level Security policies, and constraints.

**Note on the symlink:** The `packages/db` directory has a `.env` symlink pointing to the root `.env`. This is required because Prisma CLI looks for `.env` in the package directory, not the repo root. The symlink was created with:
```bash
ln -sf ../../.env packages/db/.env
```

If you clone this repo fresh on a new machine, create that symlink before running migrations.

---

## Step 7 — Regenerate Prisma Client

After migrations, regenerate the Prisma client to ensure it reflects the latest schema:

```bash
pnpm --filter @repo/db db:generate
```

This must be done after any schema change. If you skip it, TypeScript types will be stale and the app may crash at runtime on new models.

---

## Step 8 — Seed the Database

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
pnpm --filter @repo/db db:seed
```

This creates:
- 1 organization: **Acme Financial**
- 4 users with different roles
- Sample accounts (checking, savings, credit card, IRA)
- 12 transactions
- Net worth snapshot, goals, budgets
- 12 months of credit score history

The seed script is idempotent — running it twice will not create duplicates.

---

## Step 9 — Set Passwords for Seeded Users

The seeded users have no password by default (they were designed for magic-link login). To enable password-based login during development, run:

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
packages/db/node_modules/.bin/tsx packages/db/src/set-passwords.ts
```

This sets **Password123!** for all four seeded users.

---

## Step 10 — Start the Development Servers

Before starting, check that ports 3000 and 3001 are free:

```bash
lsof -i :3000 -i :3001 | grep LISTEN
```

If anything is listed, kill it:
```bash
kill $(lsof -ti :3000 -ti :3001)
```

Then start all services:

```bash
source ~/.nvm/nvm.sh
export PATH="$HOME/bin:$PATH"
export $(grep -v '^#' .env | grep -v '^$' | xargs)
pnpm turbo dev
```

Wait for both apps to report ready. You should see:

```
@repo/web:dev:  ✓ Ready in Xms
@repo/worker:dev: [INFO]: Worker service started  port: 3001
```

---

## Service URLs

| Service | URL | What to do |
|---------|-----|------------|
| Web app | http://localhost:3000 | Main dashboard |
| Login page | http://localhost:3000/login | Sign in |
| Worker health | http://localhost:3001/health | Confirms worker is alive |
| Mailhog | http://localhost:8025 | View emails (magic links) |
| Prisma Studio | `pnpm --filter @repo/db db:studio` | Browse database GUI |

---

## Test Credentials

| Email | Password | Role | What they can do |
|-------|----------|------|------------------|
| owner@acme.example | Password123! | OWNER | Everything |
| admin@acme.example | Password123! | ADMIN | Manage users, view all data, generate insights |
| member@acme.example | Password123! | MEMBER | Manage own accounts and transactions, view insights |
| viewer@acme.example | Password123! | VIEWER | Read-only access to own data |

---

## Resetting the Database

To wipe all data and start fresh:

```bash
export PATH="$HOME/bin:$PATH"
docker compose down -v
docker compose up -d
# Wait for healthy...
pnpm --filter @repo/db db:migrate:deploy
pnpm --filter @repo/db db:generate
export $(grep -v '^#' .env | grep -v '^$' | xargs)
pnpm --filter @repo/db db:seed
packages/db/node_modules/.bin/tsx packages/db/src/set-passwords.ts
```

---

## Common Issues & Fixes

### "Environment variable not found: DATABASE_URL"
The symlink is missing. Run:
```bash
ln -sf ../../.env packages/db/.env
```

### "Port 3000 is in use, trying 3001 instead"
A previous Next.js process wasn't cleanly stopped. Kill it:
```bash
kill $(lsof -ti :3000)
```

### "colima: dependency check failed for VM: lima not found"
`limactl` is in `~/bin/` but not in PATH. Run:
```bash
export PATH="$HOME/bin:$PATH"
colima status
```

### Prisma client has no `creditScore` model
The client is stale. Run:
```bash
pnpm --filter @repo/db db:generate
```

### Worker fails with "address already in use 0.0.0.0:3001"
Next.js grabbed port 3001 because 3000 was taken. Kill stale processes and restart:
```bash
kill $(lsof -ti :3000 -ti :3001)
pnpm turbo dev
```

---

## Running Tests

```bash
source ~/.nvm/nvm.sh

# Unit tests (fast, no DB required)
pnpm turbo test

# Tests with coverage report
pnpm turbo test -- --coverage

# Type checking
pnpm turbo typecheck

# Linting
pnpm turbo lint

# E2E tests (requires running dev server and Playwright browsers)
pnpm --filter @repo/web exec playwright install --with-deps chromium
pnpm turbo test:e2e
```

---

## Adding a Database Migration

1. Edit [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
2. Run in an **interactive terminal** (required by Prisma):
   ```bash
   source ~/.nvm/nvm.sh
   export $(grep -v '^#' .env | grep -v '^$' | xargs)
   cd packages/db
   npx prisma migrate dev --name describe_your_change
   ```
3. Regenerate the client:
   ```bash
   pnpm --filter @repo/db db:generate
   ```

---

## Stopping Everything

```bash
# Stop dev servers — Ctrl+C in the terminal running pnpm turbo dev

# Stop Docker services (keeps data)
export PATH="$HOME/bin:$PATH"
docker compose down

# Stop Docker services AND delete all data
docker compose down -v
```
