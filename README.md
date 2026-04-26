# Enterprise Financial Dashboard

A production-grade, multi-tenant financial management platform. Aggregates bank, credit, loan, and investment accounts via Plaid, computes real-time net worth, tracks goals and budgets, and surfaces AI-driven financial insights via an agentic Claude analysis layer.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system context, component diagrams, ERD, sequence diagrams, and threat model.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Docker + Compose | ≥ 24 | [docker.com](https://www.docker.com/get-started/) |
| make | any | pre-installed on macOS/Linux |

---

## 5-Minute Quickstart

```bash
# 1. Clone the repo
git clone <repo-url>
cd enterprise-financial-dashboard

# 2. One-command setup: installs deps, starts Docker services,
#    runs DB migrations, seeds dev data
make setup

# 3. Fill in required secrets in .env
#    (PLAID_CLIENT_ID, PLAID_SECRET, ANTHROPIC_API_KEY, AUTH_SECRET, etc.)
#    See .env.example for descriptions of every variable.

# 4. Start all services
make dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| Worker API | http://localhost:3001 |
| Mailhog (email) | http://localhost:8025 |
| Prisma Studio | run `make db-studio` |

---

## Available Commands

```bash
make setup          # First-time bootstrap
make dev            # Start all services
make test           # Run unit tests
make test-e2e       # Run Playwright E2E tests
make test-coverage  # Tests with coverage report
make lint           # ESLint
make typecheck      # TypeScript
make format         # Prettier (write)
make db-migrate     # Run pending migrations
make db-seed        # Seed dev data
make db-reset       # Reset + remigrate + reseed
make db-studio      # Open Prisma Studio
make security       # npm audit + semgrep + gitleaks
make clean          # Remove all build artifacts + Docker volumes
make help           # List all targets
```

---

## Monorepo Structure

```
enterprise-financial-dashboard/
├── apps/
│   ├── web/          # Next.js 15 (App Router) — frontend + BFF
│   └── worker/       # Fastify — Plaid sync, AI insights, webhooks
├── packages/
│   ├── config/       # Shared TypeScript + ESLint configs
│   ├── db/           # Prisma schema, migrations, seed
│   ├── shared/       # Business logic, crypto, schemas, AI tools
│   └── ui/           # Shared React components (shadcn/ui)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── ROADMAP.md
│   ├── DEFERRED.md
│   └── decisions/    # Architecture Decision Records (ADRs)
├── .github/
│   └── workflows/    # CI + security scanning
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Development Workflow

### Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Commitlint is enforced via a Husky `commit-msg` hook.

```
feat: add goal projection chart
fix: correct net worth calculation for negative credit balances
chore: bump pnpm to 9.1.1
```

### Adding a database migration

```bash
# Edit packages/db/prisma/schema.prisma, then:
make db-generate    # Regenerate Prisma client
make db-migrate     # Apply migration (creates migration file)
```

### Running a single package's tests

```bash
pnpm --filter @repo/shared test
pnpm --filter @repo/web test
```

---

## Environment Variables

Every variable is documented in [`.env.example`](.env.example). Key variables:

| Variable | Description |
|----------|-------------|
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid API credentials (sandbox for dev) |
| `PLAID_TOKEN_ENCRYPTION_KEY` | 64-char hex — AES-256 key for Plaid token storage |
| `MFA_SECRET_ENCRYPTION_KEY` | 64-char hex — AES-256 key for TOTP secret storage |
| `ANTHROPIC_API_KEY` | Claude API key for AI insights |
| `AUTH_SECRET` | Random 32+ char secret for Auth.js sessions |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (with password) |

Generate encryption keys: `openssl rand -hex 32`

---

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the full security posture including threat model, encryption design, RBAC, and audit logging.

**Report a vulnerability:** Open a [private security advisory](../../security/advisories/new) on GitHub.

---

## Contributing

1. Branch from `develop` with a descriptive name (`feat/goal-charts`, `fix/budget-rollover`)
2. Make your changes — tests are required for new business logic
3. `make lint && make typecheck && make test` must pass
4. Open a PR against `develop` with a description following the PR template
5. All CI checks must be green before merge

---

## License

Proprietary. All rights reserved.
