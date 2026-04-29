# How This Repository Was Built with Claude

## The First Prompt

The project began with a single, detailed prompt to Claude Code. The full text of the original request was:

> "Build a production-grade, multi-tenant financial management platform called Enterprise Financial Dashboard. It should aggregate bank, credit, loan, and investment accounts via Plaid, compute real-time net worth, track goals and budgets, and surface AI-driven financial insights via an agentic Claude analysis layer.
>
> Structure it as a pnpm monorepo using Turborepo with:
> - apps/web — Next.js 15 App Router frontend + BFF
> - apps/worker — Fastify background service (Plaid sync, AI insights, net worth snapshots)
> - packages/db — Prisma ORM, PostgreSQL migrations, seed data
> - packages/shared — business logic, crypto utilities, Zod schemas, AI tool definitions
> - packages/ui — shared React components (shadcn/ui)
> - packages/config — shared TypeScript and ESLint configurations
>
> Use Docker Compose for local infrastructure (Postgres 16, Redis 7, Mailhog). Build in 9 phases, gating on a human checkpoint after Phase 0 before writing any code."

This single prompt initiated the entire build — from architecture documents to working application code.

---

## Why This Prompt Was Written This Way

The prompt was deliberately structured to give Claude the full system context upfront rather than feeding requirements incrementally. This matters because:

1. **Architecture decisions compound.** Choosing BigInt for monetary values, Row-Level Security for multi-tenancy, and BullMQ for async jobs all affect each other. A piecemeal approach would have led to contradictory decisions.

2. **The 9-phase gate prevented premature code.** By explicitly requiring a human checkpoint after Phase 0 (architecture), the user ensured Claude would not write a single line of application code before the security model, data model, and ADRs were reviewed and approved.

3. **Naming every package upfront** forced Claude to reason about the dependency graph before scaffolding. This prevented circular imports and ensured shared logic landed in `packages/shared` rather than being duplicated across apps.

---

## Phase 0 — Discovery & Architecture (No Code Written)

Before any code existed, Claude produced five documents in `docs/`:

### What was created:
- **ARCHITECTURE.md** — C4-level system context and component diagrams, an entity-relationship diagram covering all 21 data models, four sequence diagrams (Plaid sync, transaction webhook, net worth calculation, agentic insight loop), and a full STRIDE threat model.
- **SECURITY.md** — Secret management strategy, AES-256-GCM encryption design for Plaid tokens and TOTP seeds, RBAC permission matrix (4 roles × 20 permissions), audit logging design, authentication flow, security headers.
- **ROADMAP.md** — 9-phase build plan with acceptance criteria per phase, Gantt timeline, and a decision log.
- **DEFERRED.md** — 11 items explicitly out of scope for v0.1.0 (e.g., multi-currency support, statement uploads, full Terraform deployment). Being explicit about what is NOT being built prevents scope creep.
- **decisions/0001–0006** — Six Architecture Decision Records (ADRs):
  - ADR-0001: Monorepo with pnpm workspaces + Turborepo
  - ADR-0002: BigInt cents for all monetary values (never floats)
  - ADR-0003: AES-256-GCM envelope encryption for Plaid tokens
  - ADR-0004: Auth.js v5 with magic links + TOTP MFA
  - ADR-0005: BullMQ over direct queue for async jobs
  - ADR-0006: Agentic tool-use loop for AI insights

### Why architecture first?
Two reasons. First, financial software has compliance and security requirements that are much harder to retrofit than to design in from the start. Row-Level Security, audit logs, and encryption must be in the schema from migration 0001 — you cannot add them to a running production database safely. Second, the ADRs serve as a living record of *why* each decision was made. When a future developer asks "why do we store money as BigInt?" the answer is in ADR-0002, not buried in a Slack thread.

---

## Phase 1 — Monorepo Scaffold & Developer Experience

With architecture approved, Claude scaffolded the entire monorepo structure. This included:

- `pnpm-workspace.yaml` declaring all workspaces
- `turbo.json` with task pipelines, caching configuration, and dependency ordering
- Root `package.json` with shared scripts
- `packages/config` with base TypeScript (`tsconfig.base.json`) and ESLint (`eslint.base.json`) configs used by every other workspace
- `docker-compose.yml` with health checks for Postgres, Redis, and Mailhog
- `Makefile` with 40+ targets for the full developer workflow
- `.env.example` documenting every environment variable
- `commitlint.config.js` + Husky pre-commit hooks for conventional commits

### Why scaffold first?
Every subsequent phase generates code that depends on build tooling, linting, and TypeScript configs. Scaffolding first means Phase 2 code is immediately type-checked and linted as it is written.

---

## Phase 2 — Database, Auth & Multi-Tenancy

This was the most foundational phase — getting it wrong would have required rewriting the entire schema later.

**Database design decisions implemented:**
- All monetary values as `BigInt` (cents), enforced by Prisma schema types and a `money.ts` utility in `packages/shared`
- Row-Level Security using a `app_current_org_id()` Postgres session variable, so the database itself rejects cross-organization data access even if application code has a bug
- An `orgClient(orgId)` Prisma proxy that sets the session variable before every query, making it impossible to forget
- An append-only `audit_logs` table enforced via Postgres RULES (the database rejects UPDATE/DELETE)

**Authentication:**
- Auth.js v5 with a credentials provider (email + password), magic link (Nodemailer → Mailhog in dev), and Google OAuth
- TOTP MFA using `otpauth` library, with secrets encrypted at rest using AES-256-GCM
- Session stores `mfa_verified_at` timestamp so middleware can enforce MFA for sensitive operations

**RBAC:**
- Four roles: OWNER, ADMIN, MEMBER, VIEWER
- 20 permissions mapped to roles in `packages/shared/src/rbac.ts`
- `requirePermission(orgId, permission)` function used on every API route handler

---

## Phase 3 — Plaid Integration

Plaid is the most complex external integration in the system. Claude implemented:

- Link token creation (`POST /api/accounts` triggers Plaid Link)
- Public token exchange and access token storage (encrypted with AES-256-GCM)
- Cursor-based transaction sync (`/transactions/sync`) — Plaid's sync API returns added/modified/removed transactions; the worker upserts/deletes accordingly
- Investments holdings sync via `/investments/holdings/get`
- Liabilities sync via `/liabilities/get`
- Webhook receiver with ES256 JWT verification and a 5-minute replay protection window (Redis sorted set)
- Re-link flow for expired/revoked access tokens

MSW (Mock Service Worker) was used to mock Plaid responses in tests, allowing the CI pipeline to test the sync logic without real Plaid credentials.

---

## Phase 4 — Net Worth & Financial Calculations

This phase introduced the pure business logic in `packages/shared`:

- `calculateNetWorth(accounts)` — sums assets minus liabilities, returns BigInt cents
- `calculateBudgetProgress(budget, transactions)` — spending vs. limit per category
- `projectGoal(goal, currentBalance)` — projects completion date from contribution rate
- `mapPlaidCategory(plaidCategory)` — maps Plaid's transaction hierarchy to the app's budget category labels
- Daily cron jobs (via BullMQ) for net worth snapshots and budget aggregation

All of these are pure functions with no database dependencies, making them trivially testable with Vitest.

---

## Phase 5 — AI Insights Layer

The AI layer uses Claude's tool-use capability to generate contextual financial insights. The architecture:

1. The insight worker dequeues a job containing `{organizationId, userId}`
2. It calls `claude.messages.create()` with a system prompt and six tool definitions
3. Claude calls tools like `get_spending_by_category` or `find_anomalous_transactions`
4. The worker executes the tool, returns results, and Claude continues reasoning
5. After up to 10 iterations, Claude produces a structured JSON insight
6. The insight is Zod-validated, then persisted with full provenance (which tools were called, how many tokens were used, which model version)

**Why tool-use instead of a single prompt?**
A single prompt would require the application to pre-fetch and format all financial data before calling Claude, even data Claude might not need for a given insight. The tool-use loop lets Claude request only what it needs, reducing token usage and giving Claude the ability to follow chains of reasoning (e.g., "I see high food spending; let me check if there's an anomalous transaction that explains it").

**Safeguards:**
- Daily token budget per user (`AI_DAILY_TOKEN_BUDGET`) prevents runaway costs
- System prompt includes explicit refusal instructions for non-financial topics
- All tool outputs are read-only (no mutations)
- Insight feedback (thumbs up/down) trains the prompt over time

---

## Phase 6 — Frontend

Next.js 15 App Router was used for the frontend. Key design decisions:

- **Route groups** `(auth)` and `(dashboard)` separate unauthenticated and authenticated routes, with the dashboard layout providing the sidebar and header shell
- **TanStack Query** for data fetching with caching and background refetching
- **Recharts** for the net worth history line chart
- **shadcn/ui** components copied into `packages/ui` (not installed as a versioned dependency, giving full control over component internals)
- **CSP nonces** generated per-request in middleware and threaded through to `<script>` tags, preventing XSS even if inline scripts are used

---

## Phase 7 — Security Hardening

After the application was functional, Claude applied a hardening pass:

- **Rate limiting**: Redis sliding-window rate limiter applied in Next.js middleware before any auth checks run. Default: 60 req/min per IP, 10 req/min for auth endpoints
- **Security headers**: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- **Content Security Policy**: Nonce-based, with `strict-dynamic` and an explicit Plaid CDN allowlist
- **RUNBOOK.md**: Incident response playbook including DB backup/restore procedures, key rotation steps, and on-call escalation paths

---

## Phase 8 — Testing

The testing strategy was layered:

| Layer | Tool | What was tested |
|-------|------|-----------------|
| Unit | Vitest | Pure functions (net worth, budget, goal, categorization, crypto, money, RBAC) |
| Property-based | fast-check | Net worth invariants, budget total bounds, goal progress monotonicity |
| Integration | Supertest + MSW | API routes, Plaid sync worker |
| RLS | Prisma + real DB | Cross-org data isolation (proves RLS works, not just application logic) |
| E2E | Playwright | Full auth flow, MFA enrollment, session security |

The RLS integration tests are worth highlighting: they create two organizations, insert data into one, and verify that queries through the other organization's `orgClient()` return zero rows — even with direct Prisma access.

---

## Phase 9 — Documentation & Handoff

The final phase produced operational documentation:

- **RUNBOOK.md** — How to operate the system in production
- **PLAID_PRODUCTION.md** — Steps to move from Plaid sandbox to production (which requires Plaid's approval process)
- **QA_CHECKLIST.md** — Manual testing sign-off checklist
- **TASKS.md** — All manual tasks that Claude cannot perform (obtaining API keys, creating AWS accounts, DNS configuration)
- **CHANGELOG.md** — Structured changelog following Keep a Changelog format

---

## Why This Process Works

The 9-phase approach with a human gate after architecture is effective for complex systems for three reasons:

**1. Irreversibility ordering.** The decisions made in Phase 0 and Phase 2 are the hardest to change later. Choosing BigInt over float for money is a migration that touches every table. Choosing RLS is a schema decision. Front-loading these decisions — and getting them reviewed — prevents expensive rewrites.

**2. Dependency clarity.** Each phase produces outputs that subsequent phases depend on. The Prisma schema (Phase 2) is a dependency of the Plaid worker (Phase 3), the AI insights layer (Phase 5), and every frontend API route (Phase 6). Writing them in order, rather than simultaneously, means each layer builds on stable ground.

**3. Testability by design.** By keeping business logic in pure functions in `packages/shared` (no database, no HTTP), testing becomes trivial and fast. This was a deliberate architectural choice made in Phase 0 and enforced throughout. Claude can run these tests in milliseconds without spinning up any infrastructure.

**The human checkpoints matter.** Claude is very good at implementing a specified design, but the design itself — the threat model, the permission matrix, the encryption key strategy — benefits from human review before implementation. The checkpoint after Phase 0 was the moment to say "actually, we need column-level encryption for this field too" rather than after it had been coded into 40 migration files.
