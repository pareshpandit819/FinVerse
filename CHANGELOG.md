# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-04-25

### Added

**Infrastructure & Monorepo (Phase 1)**
- pnpm workspaces + Turborepo monorepo with `apps/web`, `apps/worker`, `packages/db`, `packages/shared`, `packages/ui`, `packages/config`
- Docker Compose stack: PostgreSQL 16, Redis 7, Mailhog
- `make setup` bootstrap command
- ESLint, TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Prettier

**Database & Auth (Phase 2)**
- 16-table PostgreSQL schema with Row-Level Security via `app_current_org_id()` session variable
- Auth.js v5 with magic links (Nodemailer) and Google OAuth
- TOTP MFA enrollment + challenge flow with `mfa_verified_at` session stamping
- AES-256-GCM encryption for Plaid tokens and TOTP secrets
- Prisma org-scoped client proxy (`orgClient()`)
- 4-role RBAC: OWNER / ADMIN / MEMBER / VIEWER × 20 permissions
- Append-only audit log (Postgres RULES)
- Development seed: Acme Financial org, 4 users, fake Plaid data

**Plaid Integration (Phase 3)**
- Plaid Link token creation, public token exchange, re-link flow
- Cursor-based transaction sync (`/transactions/sync`) with upsert/delete
- Investments worker (`/investments/holdings/get`)
- Liabilities worker (`/liabilities/get`)
- Webhook receiver with ES256 JWT verification + replay protection (5-min window)
- BullMQ queues: `plaid.sync`, `plaid.investments`, `plaid.liabilities`
- MSW-based integration tests with `it.skipIf(!DATABASE_URL)` pattern

**Net Worth & Financial Calculations (Phase 4)**
- Net worth snapshot worker (assets − liabilities, BigInt cents throughout)
- Goal progress refresh linked to account balances
- Budget spending aggregation by Plaid category
- Transaction categorization (`mapPlaidCategory`) mapping Plaid hierarchy to budget labels
- Cron: daily net worth snapshots, daily budget aggregation, weekly insight generation

**AI Insights (Phase 5)**
- Claude Haiku agentic loop with 6 read-only financial tools
- Tools: account summary, spending by category, recurring subscriptions, goal progress, net worth trend, anomalous transaction detection
- Daily token budget per user (`AI_DAILY_TOKEN_BUDGET`)
- Insight feedback (thumbs up/down) stored per insight
- `GET /api/insights` and `POST /api/insights` (on-demand generation)

**Frontend (Phase 6)**
- Next.js 15 App Router dashboard: Overview, Accounts, Net Worth, Goals, Budgets, Insights, Settings
- Recharts `LineChart` for net worth history
- Plaid Link client component
- `@tanstack/react-query` provider
- Shared UI components: Button, Card, Badge, Progress, Input, Label, Separator, Skeleton

**Security Hardening (Phase 7)**
- Redis sliding-window rate limiter (60 req/min default, 10 req/min for sensitive endpoints)
- Per-request CSP nonces with `strict-dynamic` + Plaid CDN allow-list
- `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options` headers
- Rate limiting applied in Next.js middleware before auth checks
- `docs/RUNBOOK.md` with incident response procedures, DB queries, key rotation steps

**Testing (Phase 8)**
- Unit tests: `calculateNetWorth`, `calculateBudget`, `projectGoal`, `mapPlaidCategory`, `hasPermission`, crypto, money formatting
- Property-based tests with `fast-check`: net worth invariants, budget totals, goal progress bounds
- RLS integration tests proving cross-org data isolation
- Webhook verifier unit tests (missing header, malformed JWT, expired `iat`)
- Sync worker integration tests (upsert, modify/remove, idempotency)
- Playwright E2E: auth flow, MFA structure, session security

**Documentation (Phase 9)**
- `docs/RUNBOOK.md` — operational playbook
- `docs/PLAID_PRODUCTION.md` — production readiness checklist
- `docs/QA_CHECKLIST.md` — manual QA sign-off checklist
- `TASKS.md` — all manual human tasks organized by phase
- `CHANGELOG.md` — this file

### Architecture Decisions

- BigInt for all monetary values (no floats, ever)
- Basis points (bps) for percentages to avoid floating-point math
- Postgres RLS over application-layer filtering — enforced at DB level
- AES-256-GCM with random IV per token — designed for KMS envelope encryption in production
- BullMQ for all async work — retries, backoff, job deduplication via `jobId`
- MSW for Plaid API mocking — tests run without real Plaid credentials

[0.1.0]: https://github.com/YOUR_ORG/enterprise-financial-dashboard/releases/tag/v0.1.0
