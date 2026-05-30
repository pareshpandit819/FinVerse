# Presentation Transcript — Enterprise Financial Dashboard

**Course Presentation: Building a Production-Grade Full-Stack Application with AI**

---

## Slide 1 — Title

Good [morning/afternoon], everyone.

Today I'm going to walk you through a project called the Enterprise Financial Dashboard — a full-stack financial management platform I built from scratch. By the end of this presentation, you'll understand not just what the app does, but the exact decisions I made at each step, why I made them, and what I learned along the way.

This isn't a tutorial project. It handles multi-tenant data, real bank account connections, AI-generated financial insights, and production-grade security. Let me show you what that actually means.

---

## Slide 2 — What Does the App Do?

At its core, this is a dashboard that lets you:

1. **Connect your bank accounts** — via a service called Plaid, which is how most fintech apps (Venmo, Robinhood, Credit Karma) read your bank data without you giving them your password
2. **Track your net worth** — assets minus liabilities, updated daily
3. **Set and monitor goals** — like "save $24,000 emergency fund by December"
4. **Manage budgets** — set monthly spending limits by category, see where you are
5. **Get AI insights** — Claude analyzes your spending patterns and generates personalized recommendations
6. **Monitor your credit** — score trends, credit accounts, payment history

But honestly, the app itself is almost secondary to the engineering decisions. Let me explain how I built it.

---

## Slide 3 — The First Prompt

This entire application was built using Claude Code — Anthropic's AI coding assistant. But I didn't just say "build me a finance app." I gave it a very specific, detailed prompt.

The prompt described:
- The exact folder structure I wanted (a monorepo with specific packages)
- The tech stack for each layer (Next.js 15, Fastify, Prisma, BullMQ)
- The external integrations (Plaid for banking, Claude for AI insights)
- A 9-phase build process, with a hard gate: no code would be written until I reviewed and approved the architecture

That gate was important. Phase 0 was architecture only. No code. Just documents.

---

## Slide 4 — Architecture First (Phase 0)

Before a single line of application code was written, I had Claude produce five documents:

**ARCHITECTURE.md** — This contains C4-level system diagrams showing every component and how they interact. It has an entity-relationship diagram of all 21 database tables. It has four sequence diagrams showing exactly what happens when a user connects a bank account, when a transaction syncs, when net worth is calculated, and when an AI insight is generated. And it has a STRIDE threat model — a structured security analysis covering Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.

**SECURITY.md** — How secrets are stored, how encryption works, what the permission system looks like.

**ADRs (Architecture Decision Records)** — Six documents, each following the format: here's the problem, here's what I chose, here's the trade-off. For example: "Why BigInt for money instead of a float?" The answer: because `0.1 + 0.2 = 0.30000000000000004` in JavaScript. You cannot store money as a floating-point number. Ever.

I reviewed all of this before approving Phase 1.

Why does this matter? Because some decisions are nearly impossible to undo once you've written the code. If I had started coding and later realized I needed Row-Level Security, I'd have to rewrite every database migration. Getting these decisions right before Phase 1 prevented that.

---

## Slide 5 — Repository Structure (The Monorepo)

Let me show you the folder structure and explain why it looks the way it does.

```
enterprise-financial-dashboard/
├── apps/
│   ├── web/     ← Next.js frontend + API
│   └── worker/  ← Background job processor
├── packages/
│   ├── db/      ← Database schema + migrations
│   ├── shared/  ← Business logic (math, validation)
│   ├── ui/      ← Shared React components
│   └── config/  ← TypeScript + ESLint configs
```

This is called a monorepo — one repository containing multiple applications and packages. The key insight here is the separation of concern:

`packages/shared` contains pure functions — the net worth calculation, budget math, goal projections. These have no database calls, no HTTP calls, no side effects. They take data in, return data out. This makes them trivially testable.

`apps/worker` is where the side effects live — it reads from the database, calls external APIs, writes results back. But it calls the pure functions from `packages/shared` to do the actual math.

`apps/web` is the user interface. It also has API routes (the BFF — Backend for Frontend pattern), but it delegates all heavy lifting to the worker via job queues.

This separation isn't just aesthetic. It means the business logic has 100% test coverage because it's easy to test. The hard-to-test parts (HTTP calls, database writes) are isolated to the edges of the system.

---

## Slide 6 — The Database Design

The database has 21 tables. Let me highlight the design decisions that made this production-grade.

**BigInt for money.** Every monetary value in this database is stored as an integer number of cents in a BigInt column. $48.52 is stored as `4852`. No floats. Ever. This eliminates an entire category of bugs.

**Multi-tenancy with Row-Level Security.** This app supports multiple organizations. User A's data must be invisible to User B's organization even if a bug in the application code forgets to filter. The solution: Postgres Row-Level Security.

Every table has an `organization_id` column. There's a Postgres session variable called `app.current_org_id`. Every query that touches sensitive data is wrapped in a policy that says: "only return rows where `organization_id = current_setting('app.current_org_id')`."

In the code, there's an `orgClient(orgId)` function. Every time you call it, it sets that session variable before running any queries. So even if a developer forgets to add a WHERE clause, the database rejects the data. Defense in depth.

**Append-only audit log.** There's an `audit_logs` table. When any sensitive data is modified (account created, transaction updated, role changed), a record is written. Crucially, this table has a Postgres RULE that rejects UPDATE and DELETE statements at the database level. You cannot modify the audit log, not even if you have direct database access. This is a compliance requirement in financial applications.

---

## Slide 7 — Authentication and Security

The authentication system has three layers:

**Layer 1: Email + Password or Magic Link.** Users can sign in with a password, or request a magic link that's sent to their email. This uses Auth.js v5 with a Nodemailer adapter. In development, all emails go to Mailhog — a fake inbox you access at localhost:8025.

**Layer 2: TOTP Multi-Factor Authentication.** OWNER and ADMIN roles are required to enroll in MFA within 24 hours of account creation. They use an authenticator app (Google Authenticator, Authy) to scan a QR code. The TOTP secret is encrypted with AES-256-GCM before being stored in the database. The session stores a `mfa_verified_at` timestamp, and sensitive endpoints check how long ago MFA was verified.

**Layer 3: RBAC — Role-Based Access Control.** There are four roles: OWNER, ADMIN, MEMBER, VIEWER. Each maps to a set of 20 permissions. Every single API route begins with `requirePermission(orgId, 'permission.name')`. If that check fails, the route returns 401 or 403 before touching anything else.

The security headers applied to every response: `Strict-Transport-Security` (HTTPS only), `X-Frame-Options: DENY` (no iframes), `X-Content-Type-Options: nosniff`, and a Content Security Policy with per-request nonces. These are the headers that make a web application actually secure, not just functional.

---

## Slide 8 — The Worker Service

The worker is a separate Node.js service built with Fastify. It runs alongside the web app and processes background jobs.

Why separate? Because some operations take too long or are too resource-intensive to run inside an HTTP request. If generating an AI insight takes 10 seconds, you don't want the user's browser waiting. You queue the job, return a 202 Accepted, and the user gets notified when it's done.

The job queue is BullMQ, backed by Redis. Think of a queue as a to-do list:
1. The web app adds a job: "generate insights for user X"
2. The worker picks it up, processes it
3. Results are written to the database
4. Next time the user opens the insights page, the new insight is there

**Three queues:**
- `net-worth.snapshot` — runs every night at 2 AM, calculates and stores today's net worth
- `budget.aggregate` — runs every night at 2:30 AM, sums up spending by category
- `insights.generate` — runs every Monday morning, calls Claude for AI insights

---

## Slide 9 — The AI Insights Layer

This is the most interesting part. The insights don't come from a single prompt to Claude. They use Claude's tool-use capability — an agentic loop.

Here's how it works:

1. The worker starts with an empty context — it doesn't pre-fetch any financial data
2. It sends Claude a system prompt: "You are a financial advisor. Use the tools available to analyze this user's finances and generate actionable insights."
3. Claude responds with a tool call: "Call `get_spending_by_category` for the last 30 days"
4. The worker executes that function against the database and returns the results to Claude
5. Claude might call another tool: "I see high dining spending. Let me check `find_anomalous_transactions` to see if there's one big outlier."
6. This continues for up to 10 iterations
7. Claude produces a structured JSON insight, which is Zod-validated and persisted

Why this approach instead of just sending all the data upfront? Because:
- Claude only fetches what it needs for a given user's situation
- The reasoning is transparent — you can see which tools were called and why
- Token usage is lower because we're not sending irrelevant data
- Claude can follow chains of reasoning naturally

Every insight is stored with full provenance: which model version generated it, which tools were called in which order, the exact token counts, a hash of the prompt. This is important for debugging and for detecting if the model's behavior changes between versions.

---

## Slide 10 — The Frontend

The frontend is Next.js 15 using the App Router. Let me explain what that means.

In traditional web apps, you have a frontend and a backend as completely separate systems. In Next.js 15, the same codebase handles both. React Server Components run on the server — they can query the database directly. Client Components run in the browser.

The route structure mirrors the URL structure:

```
app/(dashboard)/dashboard/page.tsx  →  localhost:3000/dashboard
app/(dashboard)/credit/page.tsx     →  localhost:3000/credit
app/(auth)/login/page.tsx           →  localhost:3000/login
```

The parentheses in `(dashboard)` and `(auth)` create what Next.js calls "route groups" — they affect the layout but not the URL. Everything inside `(dashboard)` shares the sidebar navigation layout. Everything inside `(auth)` has a plain centered layout.

Data fetching is handled by TanStack Query. When you navigate to the Accounts page, it queries `GET /api/accounts`. TanStack Query caches the result, so navigating back doesn't re-fetch. When you add an account, it invalidates the cache and re-fetches.

Charts are built with Recharts — the net worth history line chart, the credit score trend chart. These take BigInt data from the API, convert it to display-ready numbers, and render SVG charts.

---

## Slide 11 — Local Infrastructure with Docker

You don't need to install PostgreSQL or Redis locally. The entire infrastructure runs in Docker containers.

The `docker-compose.yml` file defines three services:
- **PostgreSQL 16** — the database
- **Redis 7** — the job queue and rate limiter
- **Mailhog** — a fake email server with a web UI

One command: `docker compose up -d` — and all three are running. They have health checks, so the setup script waits for them to be ready before running migrations.

This is one of the most important developer experience decisions in a production codebase. Any new team member can clone the repo, run `make setup`, and have a fully functioning development environment in under five minutes. No "it works on my machine" problems.

---

## Slide 12 — The Make Workflow

The `Makefile` is the developer's command center. Instead of remembering complex pnpm commands, you use short `make` targets:

```bash
make setup        # First-time: install deps, start Docker, migrate, seed
make dev          # Start everything in development mode
make test         # Run all unit tests
make db-reset     # Wipe the database and start fresh
make lint         # Check code style
make typecheck    # TypeScript type checking
make security     # Run npm audit, Semgrep, Gitleaks
```

The `make setup` target does something clever. Before starting, it checks that Node, pnpm, and Docker are all installed. If any are missing, it prints a clear error message with install instructions. This prevents confusing failures later.

---

## Slide 13 — Testing Strategy

There are four layers of testing:

**Unit tests with Vitest** — the pure functions in `packages/shared`. These test `calculateNetWorth`, `calculateBudgetProgress`, `projectGoal`, the encryption/decryption round-trips. They run in milliseconds with no database or network.

**Property-based tests with fast-check** — rather than testing specific input/output pairs, property-based tests verify invariants. For example: "for any set of accounts, net worth should equal total assets minus total liabilities." fast-check generates hundreds of random inputs and checks the property holds for all of them.

**Integration tests** — these test the Plaid sync worker against a real database using MSW to mock Plaid's API. They verify that the cursor-based sync correctly handles added, modified, and deleted transactions.

**RLS integration tests** — these are the most important security tests. They create two organizations, insert data into organization A, and verify that queries through organization B's `orgClient()` return zero rows. This proves the Row-Level Security is actually working, not just the application-layer filter.

**E2E tests with Playwright** — tests the full user flow in a real browser. Login, MFA enrollment, session expiry.

---

## Slide 14 — What I Actually Learned

Let me be honest about what was hard and what I learned from this project.

**The hardest part was the BigInt serialization.** JSON doesn't support BigInt. When you do `JSON.stringify({balance: 4852n})`, it throws an error. I had to write a custom `serializeMoney` replacer and `deserializeMoney` reviver for every API response that contained monetary data. It works, but it required discipline across every single endpoint.

**Row-Level Security is deceptively tricky.** Getting the Postgres session variable to work through a connection pool (where connections are reused across requests) required setting the variable at the beginning of every transaction, not just at connection time. The `orgClient()` Prisma middleware handles this, but debugging it took a while.

**The Prisma-env path issue.** Prisma CLI looks for `.env` in the package directory, not the repository root. In a monorepo, the `.env` is at the root. The fix was a symlink: `packages/db/.env → ../../.env`. Simple, but not obvious — it took troubleshooting to discover.

**Tool-use output validation.** Claude's structured output is not guaranteed to match your expected schema. The Zod validation on the insight output catches cases where Claude returns a field with a different type than expected, or omits a required field. Without that validation, a model behavior change would silently corrupt data.

---

## Slide 15 — Live Demo

Let me show you the running application.

*[Open browser to http://localhost:3000/login]*

I'll sign in as the owner account — `owner@acme.example` with password `Password123!`. This user has the OWNER role, which has full access to everything.

*[Sign in]*

This is the dashboard overview — you can see the net worth summary, recent transactions, and quick stats.

*[Navigate to Net Worth]*

Here's the net worth chart. This shows the 90-day trend for the Acme Financial demo organization. The data was seeded — in a real deployment, this would be calculated nightly from the connected bank accounts.

*[Navigate to Credit]*

This is the credit dashboard. You can see the score trend over 12 months — this one starts at 710 and trends up to 745. Below that are the individual credit accounts: two cards, a mortgage, auto loan, and student loan. The payment history events are tracked here.

*[Navigate to Insights]*

This is where Claude's AI insights would appear. To see a live one, you'd need an Anthropic API key configured. The trigger button here queues an insight generation job on the worker.

*[Open Mailhog at http://localhost:8025]*

This is Mailhog — all emails the app sends appear here. If I were using magic link sign-in instead of password login, the link would have appeared here.

*[Open Prisma Studio via pnpm --filter @repo/db db:studio]*

This is Prisma Studio — a visual database browser. You can see every table, every record. Here's the audit_logs table — every action recorded, immutable.

---

## Slide 16 — If I Were to Continue This Project

The `docs/DEFERRED.md` file lists what's out of scope for v0.1.0. If I were to continue:

1. **Plaid production access** — I need to go through Plaid's review process to move from sandbox to real bank connections. That involves privacy policy, terms of service, and a security review.

2. **Full AWS deployment** — the `TASKS.md` has the full list: ECS Fargate containers, RDS Multi-AZ database, ElastiCache for Redis, Secrets Manager for credentials, CloudFront CDN.

3. **Multi-currency support** — currently all amounts are assumed to be USD. Supporting GBP, EUR, etc. requires currency conversion and a different approach to aggregated totals.

4. **Statement upload** — users could upload PDF or CSV bank statements for accounts that don't support Plaid.

5. **Real-time notifications** — currently insights are weekly. A WebSocket layer could push real-time alerts ("Your food spending is 40% higher than last month").

---

## Slide 17 — Key Takeaways

Here's what I want you to take from this presentation:

**Architecture before code pays dividends.** Spending time on design documents, threat models, and ADRs before writing code prevented several expensive mistakes. The Row-Level Security design, the BigInt decision, the encryption strategy — all of these were right from day one because they were thought through before implementation.

**Monorepos enable this kind of structure.** Being able to share business logic, schemas, and types across the web app and worker without duplicating code is essential at this scale. pnpm workspaces + Turborepo made this practical.

**Security is a first-class concern, not an afterthought.** RBAC, rate limiting, CSP headers, encrypted secrets, append-only audit logs — these were designed in from Phase 0, not added at the end. Adding security to an existing system is dramatically harder.

**AI is most useful when it has the right access pattern.** The agentic tool-use loop gives Claude the ability to explore the data naturally rather than receiving a fixed dump. The quality of insights is better and the token cost is lower.

**Pure functions are worth the investment.** All the financial math in `packages/shared` is in pure functions with no side effects. This made testing trivial, debugging easy, and reuse across the web and worker seamless.

---

## Slide 18 — Q&A

Thank you. I'm happy to take questions.

Some things I'm prepared to discuss in more detail:
- The Plaid integration flow (how the token exchange works)
- The agentic Claude loop (how tool-use works in practice)
- Row-Level Security in Postgres (how to set it up)
- The BigInt serialization problem and its solutions
- How the BullMQ job queue handles failures and retries
- The Auth.js v5 configuration (credentials, magic links, MFA in one system)
- How Turborepo caches build outputs for faster CI

*[End of transcript]*

---

## Appendix — Architecture Diagram (for slides)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser                                  │
│                  Next.js 15 UI                               │
│         (React Server Components + Client Components)        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│               apps/web (Next.js 15)                          │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Auth Module  │  │ BFF Route    │  │ Middleware       │   │
│  │ Auth.js v5  │  │ Handlers     │  │ Rate Limit +     │   │
│  │ MFA / RBAC  │  │ /api/*       │  │ Security Headers │   │
│  └─────────────┘  └──────┬───────┘  └──────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                           │ BullMQ jobs / Prisma
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐  ┌─────▼──────┐  ┌────▼──────────┐
    │ PostgreSQL  │  │   Redis    │  │ apps/worker   │
    │   (Prisma)  │  │ (BullMQ)   │  │ (Fastify)     │
    │ Row-Level   │  │ Job Queue  │  │ Net Worth     │
    │ Security    │  │ Rate Limit │  │ Budget        │
    │ Audit Logs  │  │ Sessions   │  │ Insights      │
    └─────────────┘  └────────────┘  └──────┬────────┘
                                            │ HTTPS
                                     ┌──────▼───────┐
                                     │  Plaid API   │
                                     │  Claude API  │
                                     └──────────────┘
```

## Appendix — Test Credentials

| Email | Password | Role |
|-------|----------|------|
| owner@acme.example | Password123! | OWNER — full access |
| admin@acme.example | Password123! | ADMIN — manage users, all data |
| member@acme.example | Password123! | MEMBER — own data only |
| viewer@acme.example | Password123! | VIEWER — read-only |

## Appendix — Running Locally (Quick Reference)

```bash
# 1. Start Docker runtime
export PATH="$HOME/bin:$PATH"
colima start  # or Docker Desktop

# 2. Start infrastructure
docker compose up -d

# 3. Install deps + migrate + seed
source ~/.nvm/nvm.sh
pnpm install
export $(grep -v '^#' .env | grep -v '^$' | xargs)
pnpm --filter @repo/db db:migrate:deploy
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db db:seed
packages/db/node_modules/.bin/tsx packages/db/src/set-passwords.ts

# 4. Start the app
pnpm turbo dev

# 5. Open http://localhost:3000
```
