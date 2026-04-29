# Code Explanation — Enterprise Financial Dashboard

This document explains every folder and file in the repository, from the top level down to individual source files.

---

## Top-Level Structure

```
enterprise-financial-dashboard/
├── apps/               All runnable applications
├── packages/           Shared libraries consumed by apps
├── docs/               Architecture, security, and operational docs
├── tutorial/           This folder — guides and explanations
├── .github/            GitHub Actions CI/CD workflows
├── .husky/             Git hooks (pre-commit linting)
├── node_modules/       pnpm hoisted dependencies
├── docker-compose.yml  Local infrastructure definition
├── Makefile            Developer workflow automation (40+ targets)
├── turbo.json          Turborepo task pipeline configuration
├── pnpm-workspace.yaml Defines which folders are workspaces
├── package.json        Root workspace metadata and shared scripts
├── pnpm-lock.yaml      Lockfile — exact dependency versions
├── commitlint.config.js Conventional commit enforcement rules
├── .prettierrc.json    Code formatter configuration
├── .env.example        Template for all required environment variables
├── .env                Your local environment variables (git-ignored)
├── .gitignore          Files excluded from version control
├── CHANGELOG.md        What changed in each release
├── TASKS.md            Manual tasks that require human action
└── README.md           Project overview and quickstart
```

### `docker-compose.yml`
Defines three services for local development:
- **postgres** — PostgreSQL 16 Alpine, the primary database. Listens on port 5432. Data persisted in a named volume `postgres_data`.
- **redis** — Redis 7 Alpine, used for the BullMQ job queue, rate limiting, and session caching. Listens on port 6379 with password authentication.
- **mailhog** — A fake SMTP server that captures all outgoing email. Web UI at port 8025. Used to view magic-link sign-in emails during development without a real email provider.

All three services have health checks so that the `make setup` command waits for them to be ready before running migrations.

### `Makefile`
The primary developer interface. Contains 40+ targets grouped by category:
- **Bootstrap:** `make setup` runs the full first-time setup
- **Development:** `make dev` starts all services via Turborepo
- **Database:** `make db-migrate`, `make db-seed`, `make db-reset`, `make db-studio`
- **Code quality:** `make lint`, `make typecheck`, `make format`
- **Testing:** `make test`, `make test-e2e`, `make test-coverage`
- **Infrastructure:** `make docker-up`, `make docker-down`
- **Security:** `make security` runs npm audit, Semgrep, and Gitleaks
- **Cleanup:** `make clean` removes build artifacts and Docker volumes

### `turbo.json`
Turborepo configuration. Defines the task dependency graph so tasks run in the right order with maximum parallelism. For example, `build` depends on `build` in upstream packages, so `packages/shared` is built before `apps/web`. The `dev` task is marked `persistent: true` so Turborepo keeps it running. Results are cached by input file hashes — if nothing changed, the cached output is used.

### `pnpm-workspace.yaml`
Declares `apps/*` and `packages/*` as pnpm workspaces. This makes it possible to reference packages by name (`@repo/shared`, `@repo/db`) instead of relative paths, and ensures all dependencies are installed in a single `pnpm install` from the root.

### `commitlint.config.js`
Enforces Conventional Commits format (e.g., `feat:`, `fix:`, `chore:`). Combined with Husky, this runs on every commit message and rejects non-conforming messages. This keeps the git log clean and enables automatic changelog generation.

---

## apps/

### `apps/web/` — Next.js 15 Frontend

The web application. Uses Next.js 15's App Router, which means routing is defined by the folder structure under `src/app/`. It serves both the React UI and the backend API routes (BFF pattern — Backend for Frontend).

```
apps/web/
├── src/
│   ├── app/            Next.js App Router (pages, layouts, API routes)
│   ├── components/     React UI components
│   ├── lib/            Server-side utilities (auth, RBAC, rate-limiting)
│   ├── middleware.ts   Request interceptor (auth checks + security headers)
│   └── types/          TypeScript type augmentations
├── public/             Static files (images, icons)
├── next.config.ts      Next.js configuration
├── tailwind.config.ts  Tailwind CSS configuration
├── postcss.config.mjs  PostCSS configuration (required by Tailwind)
├── tsconfig.json       TypeScript config (extends packages/config)
├── .eslintrc.json      ESLint config (extends packages/config)
└── package.json        App dependencies and scripts
```

#### `src/app/` — Route Structure

```
app/
├── layout.tsx           Root HTML shell — sets <html>, <head> metadata, global providers
├── page.tsx             Route "/" — redirects authenticated users to /dashboard, others to /login
├── globals.css          Global CSS — Tailwind directives + CSS variables for shadcn/ui theming
├── providers.tsx        Client-side React context — wraps app with TanStack Query, Sonner toasts
│
├── (auth)/              Route group — unauthenticated pages (no sidebar layout)
│   ├── login/
│   │   └── page.tsx     Login form — email + password, links to magic-link, Google OAuth
│   ├── register/
│   │   └── page.tsx     Registration form — name, email, password
│   ├── mfa/
│   │   ├── enroll/
│   │   │   └── page.tsx  MFA enrollment — shows QR code for authenticator app
│   │   └── challenge/
│   │       └── page.tsx  MFA challenge — enter 6-digit TOTP code during login
│
└── (dashboard)/         Route group — authenticated pages (share sidebar layout)
    ├── layout.tsx        Dashboard shell — sidebar navigation, top header, session guard
    ├── dashboard/
    │   └── page.tsx      Overview — net worth summary card, recent transactions, quick stats
    ├── accounts/
    │   └── page.tsx      Accounts list — all connected financial accounts, Connect Account button
    ├── net-worth/
    │   └── page.tsx      Net worth chart — 90-day line chart of total net worth trend
    ├── goals/
    │   └── page.tsx      Goals tracker — progress bars, projected completion dates
    ├── budgets/
    │   └── page.tsx      Budget view — monthly spending vs. limits by category
    ├── credit/
    │   └── page.tsx      Credit dashboard — score trend, credit accounts, history events
    └── insights/
        └── page.tsx      AI insights — list of Claude-generated insights, feedback buttons
```

#### `src/app/api/` — API Routes (BFF)

```
api/
├── auth/
│   └── [...nextauth]/
│       └── route.ts      Auth.js catch-all handler — handles sign-in, sign-out, callbacks
│   ├── mfa/
│   │   ├── enroll/route.ts    POST — generates TOTP secret, returns QR code URI
│   │   └── verify/route.ts    POST — verifies TOTP code, stamps mfa_verified_at on session
├── register/
│   └── route.ts          POST — creates user account (name, email, hashed password)
├── accounts/
│   ├── route.ts          GET — list financial accounts | POST — create Plaid link token
│   └── [id]/
│       └── route.ts      GET — single account | PUT — update | DELETE — remove
├── transactions/
│   ├── route.ts          GET — paginated transaction list (filterable by account, category, date)
│   └── [id]/
│       └── route.ts      GET — single transaction | PUT — update category/notes
├── insights/
│   ├── route.ts          GET — list insights | POST — trigger on-demand insight generation
│   └── [id]/
│       └── feedback/
│           └── route.ts  POST — record thumbs up/down feedback on an insight
└── credit/
    ├── scores/route.ts   GET — credit score history (12 months)
    ├── accounts/route.ts GET — credit accounts (cards, loans)
    └── history/route.ts  GET — credit history events
```

#### `src/lib/` — Server-Side Utilities

**`auth.ts`**
Auth.js v5 configuration. Defines providers (credentials, Google), session strategy (JWT), callbacks that add `userId`, `orgId`, and `mfaVerified` to the session token, and the `db` adapter for persisting sessions to Postgres.

**`auth.config.ts`**
A lightweight subset of the auth config that can be imported in Edge Runtime (middleware). Auth.js requires this split because the full config imports `bcryptjs` which is not Edge-compatible.

**`rbac.ts`**
Permission enforcement. The `requirePermission(orgId, permission)` function:
1. Gets the current session
2. Looks up the user's membership in the specified org
3. Checks whether their role grants the required permission
4. Throws a typed error (401 or 403) if not
Every API route calls this before touching the database.

**`org.ts`**
Organization context resolution. When a user belongs to multiple organizations, the active org is stored in a cookie (`efd-active-org`). This module reads the cookie, validates it, and falls back to the user's first membership.

**`rate-limit.ts`**
Redis sliding-window rate limiter. For a given key (IP address or user ID), it maintains a sorted set in Redis where each member is a timestamp. On each request:
1. Remove timestamps older than the window (e.g., 60 seconds)
2. Count remaining members
3. If count ≥ limit, reject with 429
4. Otherwise add current timestamp and allow

This runs before any auth check so it also protects against brute-force attacks on the login endpoint.

**`queues.ts`**
BullMQ client-side producer. Creates queue references pointing to the worker service so that API routes can enqueue jobs (e.g., trigger insight generation, schedule a Plaid sync).

**`format.ts`**
Display formatting utilities. `formatCurrency(bigintCents)` converts BigInt cents to a display string like "$1,234.56". `formatDate`, `formatRelativeDate` for consistent date display across the UI.

**`csp.ts`**
Content Security Policy nonce generation. Generates a random nonce per request, stores it in a header, and passes it to React Server Components via `headers()`. The nonce is required by `strict-dynamic` CSP, which only allows scripts that carry the per-request nonce.

#### `src/components/` — React UI Components

**`sidebar.tsx`**
The left navigation panel. Contains links to all dashboard sections with icons. Highlights the active route. Collapses on mobile.

**`net-worth-chart.tsx`**
Recharts `LineChart` showing the user's net worth over the past 90 days. Fetches data from `GET /api/net-worth/snapshots`. Formats Y-axis values as currency using `formatCurrency`. Includes a tooltip with exact value and date.

**`credit-history-chart.tsx`**
Line chart of credit score over the past 12 months. Shows trend direction and highlights the most recent score.

**`credit-accounts.tsx`**
Card-based list of the user's credit products (credit cards, mortgage, auto loan, student loan). Shows balance, limit, minimum payment, due date, and payment status with a color-coded badge.

**`credit-factors.tsx`**
Visual breakdown of the five credit score factors (payment history, credit utilization, credit age, derogatory marks, hard inquiries) shown as labeled progress bars with percentage scores.

**`add-account-dialog.tsx`**
Modal dialog that triggers the Plaid Link flow. Calls `POST /api/accounts` to get a Plaid link token, then initializes the Plaid Link widget with that token. On success, exchanges the public token.

**`add-transaction-dialog.tsx`**
Form dialog for manually adding a transaction (for accounts not connected via Plaid). Validates input with the shared Zod schema before submitting.

**`trigger-insight-button.tsx`**
A button that calls `POST /api/insights` to trigger on-demand AI insight generation. Shows a loading spinner while the job is queued, then refreshes the insight list.

**`insight-feedback.tsx`**
Thumbs up / thumbs down component rendered under each insight card. Calls `POST /api/insights/[id]/feedback` with the rating. Optimistically updates the UI.

#### `src/middleware.ts`
Next.js middleware runs on every request before any route handler. It:
1. Applies rate limiting (using the Redis limiter)
2. Checks authentication (using the lightweight `auth.config.ts`)
3. Redirects unauthenticated users to `/login`
4. Redirects authenticated users away from auth pages to `/dashboard`
5. Sets all security headers on every response (HSTS, X-Frame-Options, CSP nonce, etc.)

---

### `apps/worker/` — Fastify Background Service

A standalone Node.js service that handles all asynchronous work. It does not serve the user interface — only background jobs and the `/health` endpoint.

```
apps/worker/
├── src/
│   ├── index.ts         Entry point — starts Fastify server and all workers
│   ├── routes/
│   │   └── health.ts    GET /health — returns 200 if server is up
│   ├── queues/
│   │   ├── sync.ts      BullMQ Queue instances (insightsQueue, netWorthQueue, budgetQueue)
│   │   └── cron.ts      Cron job scheduling at startup
│   ├── workers/
│   │   ├── index.ts         Initializes all workers, registers error handlers
│   │   ├── net-worth-worker.ts  Calculates and persists daily net worth snapshot
│   │   ├── budget-worker.ts     Aggregates transaction spending per budget category
│   │   └── insight-worker.ts    Agentic Claude loop for generating financial insights
│   └── lib/
│       ├── redis.ts         IORedis client (shared by BullMQ and rate limiter)
│       └── insight-tools.ts Tool implementations called during Claude's agentic loop
├── tsconfig.json
└── package.json
```

#### `src/index.ts`
Creates the Fastify server with Pino logging. Registers the health route. Calls `startWorkers()`. Starts the HTTP server. On `SIGTERM` / `SIGINT`, gracefully closes BullMQ workers (lets in-progress jobs finish) before shutting down.

#### `src/routes/health.ts`
A single `GET /health` route that returns `{status: "ok", timestamp: ...}`. Used by Docker health checks and load balancer probes in production.

#### `src/queues/sync.ts`
Creates BullMQ `Queue` instances connected to Redis. These are producer-side references — the worker registers consumers in `src/workers/`. Three queues:
- `net-worth.snapshot` — triggered daily and on-demand
- `budget.aggregate` — triggered daily and when transactions are synced
- `insights.generate` — triggered weekly and on-demand by the frontend

#### `src/queues/cron.ts`
Called at server startup. Schedules recurring jobs using BullMQ's `repeat` option:
- Daily net worth snapshots — 2:00 AM UTC
- Daily budget aggregation — 2:30 AM UTC  
- Weekly insights — Monday 6:00 AM UTC

Jobs use deterministic `jobId` values, so restarting the worker does not create duplicate cron entries.

#### `src/workers/net-worth-worker.ts`
Processes jobs from `net-worth.snapshot` queue:
1. Loads all financial accounts for the user/org
2. Calls `calculateNetWorth(accounts)` from `packages/shared`
3. Breaks down totals by account type (checking, savings, investment, credit_card)
4. Upserts a `NetWorthSnapshot` record for today's date
5. Refreshes goal progress percentages that are linked to those accounts

#### `src/workers/budget-worker.ts`
Processes jobs from `budget.aggregate` queue:
1. Finds the current month's budget for the user/org
2. Loads all transactions for the current month
3. Groups them by category using `mapPlaidCategory()`
4. Sums spending per category
5. Updates `spentAmount` on each `BudgetCategory` record

#### `src/workers/insight-worker.ts`
The most complex worker. Runs the agentic Claude loop:
1. Checks the user's remaining daily token budget (stored in Redis)
2. Builds a system prompt describing the user's financial context
3. Calls `anthropic.messages.create()` with 6 tool definitions
4. Loop: if Claude returns `tool_use` blocks, execute each tool, collect `tool_result` blocks, send them back
5. Continue until Claude returns `end_turn` or the 10-iteration limit is reached
6. Parse and Zod-validate Claude's final structured output
7. Persist the `Insight` record with full provenance (model ID, tool call log, prompt hash, token counts)

#### `src/lib/redis.ts`
Creates and exports a single IORedis client instance. Both BullMQ and the rate limiter share this connection. Configured with the `REDIS_URL` environment variable. Implements connection retry logic.

#### `src/lib/insight-tools.ts`
Implements the six tool functions that Claude calls during the insight loop. Each function queries the database and returns aggregated data. These are read-only — they never mutate anything.

| Tool | What it returns |
|------|----------------|
| `get_account_summary` | Total assets, liabilities, net worth grouped by account type |
| `get_spending_by_category` | Transaction totals by category for the last N days, with % of total |
| `get_recurring_subscriptions` | Merchants appearing every month with estimated monthly cost |
| `get_goal_progress` | Current balance vs. target, on-track status, projected completion date |
| `get_net_worth_trend` | Array of {date, netWorth} for the last 90 days |
| `find_anomalous_transactions` | Transactions more than 2 standard deviations above the category mean |

---

## packages/

### `packages/db/` — Database Layer

Everything related to the database: schema, migrations, client configuration, seed data, and audit utilities.

```
packages/db/
├── prisma/
│   ├── schema.prisma    Complete data model — all 21 tables defined here
│   └── migrations/      SQL migration files (one folder per migration)
│       ├── 20260425000000_init/migration.sql
│       ├── 20260425000001_sessions_mfa/migration.sql
│       └── 20260429000000_add_credit_score/migration.sql
├── src/
│   ├── client.ts        Singleton PrismaClient with logging config
│   ├── org-client.ts    orgClient(orgId) — sets RLS session variable
│   ├── audit.ts         writeAudit() — persists immutable audit log entries
│   ├── index.ts         Public exports for consumers of this package
│   ├── seed.ts          Development data seeding script
│   └── set-passwords.ts Utility to set passwords for seeded dev users
├── .env                 Symlink to ../../.env (required for Prisma CLI)
├── tsconfig.json
└── package.json
```

#### `prisma/schema.prisma`
Defines all 21 data models. Key design decisions embedded here:
- `BigInt` type on all monetary fields (e.g., `amount BigInt`, `limitAmount BigInt`)
- `@db.Uuid` on all `id` fields (UUIDs, not auto-increment integers)
- `@map("snake_case")` annotations that map TypeScript camelCase to Postgres snake_case columns
- `@@map("plural_snake_case")` annotations for table names
- Cascading deletes defined with `onDelete: Cascade` to prevent orphaned records

**All 21 models:**

| Model | Table | Purpose |
|-------|-------|---------|
| Organization | organizations | Multi-tenant container — every piece of data belongs to an org |
| User | users | Identity record — email, name, hashed password, avatar |
| Session | sessions | Auth.js session store (token, expiry, mfaVerifiedAt) |
| Account | accounts | Auth.js OAuth provider linkage (Google, etc.) |
| VerificationToken | verification_tokens | Magic link tokens |
| Membership | memberships | Links users to orgs with a role (OWNER/ADMIN/MEMBER/VIEWER) |
| MfaSecret | mfa_secrets | Encrypted TOTP seed + verified flag |
| AuditLog | audit_logs | Immutable mutation log (action, entity, before/after JSON, IP) |
| FinancialAccount | financial_accounts | Connected bank/investment account (type, balance, currency) |
| Transaction | transactions | Financial transaction (amount, date, category, merchant, Plaid cursor) |
| Holding | holdings | Investment position (security, quantity, value, cost basis) |
| Security | securities | Financial instrument metadata (ticker, name, type, close price) |
| Liability | liabilities | Credit product details (balance, limit, APR, minimum payment) |
| NetWorthSnapshot | net_worth_snapshots | Daily aggregate (totalAssets, totalLiabilities, breakdown JSON) |
| Goal | goals | Financial target with linked accounts, contribution rate, target date |
| Budget | budgets | Monthly spending plan (month, year, rollover flag) |
| BudgetCategory | budget_categories | Category within a budget (limitAmount, spentAmount) |
| CreditScore | credit_scores | Point-in-time credit score with factor breakdown |
| CreditAccount | credit_accounts | Credit product (type, balance, limit, APR, payment details) |
| CreditHistory | credit_history | Timeline of credit events (payment, account open, limit change) |
| Insight | insights | AI-generated insight with provenance (model, tools, tokens, hash) |

#### `src/client.ts`
Creates a singleton `PrismaClient` with query/warn/error logging enabled in development. The singleton pattern prevents connection pool exhaustion in Next.js development mode (where modules hot-reload and would otherwise create a new client on every edit).

#### `src/org-client.ts`
The `orgClient(orgId)` function returns a Prisma client extended with middleware that:
1. Before every query, runs `SET LOCAL app.current_org_id = '<orgId>'`
2. This sets a Postgres session variable
3. All Row-Level Security policies check `current_setting('app.current_org_id')` against the `organization_id` column
4. Queries that access another org's data are rejected at the database level

This is the defense-in-depth layer: even if application code forgets to filter by org, the database enforces the boundary.

#### `src/audit.ts`
`writeAudit(params)` creates an `AuditLog` record. Parameters:
- `action` — what happened (e.g., `"account.create"`, `"user.login"`)
- `entityType` / `entityId` — what was affected
- `before` / `after` — JSON snapshots of the record before and after mutation
- `ipAddress` — caller's IP from the request headers
- Sensitive fields (passwords, tokens, secrets) are redacted before the snapshot is stored

The `audit_logs` table has a Postgres RULE that rejects UPDATE and DELETE statements, making the log append-only.

#### `src/seed.ts`
Development seeding script. Creates a reproducible baseline dataset:
- Acme Financial organization
- 4 users (owner, admin, member, viewer) with memberships
- MFA secret enrolled for the owner
- 4 financial accounts (checking, savings, Amex credit card, Fidelity IRA)
- 12 sample transactions over the past 30 days
- 1 net worth snapshot
- 1 goal (Emergency Fund)
- 1 monthly budget with 7 categories
- 12 monthly credit score snapshots
- 6 credit accounts (2 cards, mortgage, auto loan, student loan, line of credit)
- 6 credit history events

All creates use `upsert` with stable IDs, so re-running the seed is safe.

#### `src/set-passwords.ts`
A one-off utility script. Bcrypt-hashes `"Password123!"` and updates the seeded users' `password` column. Run after seeding to enable password-based login during development.

---

### `packages/shared/` — Business Logic & Schemas

Pure TypeScript modules with no framework dependencies. These can be imported by both the web app and the worker without circular dependencies.

```
packages/shared/src/
├── crypto.ts        AES-256-GCM encrypt/decrypt for sensitive secrets
├── totp.ts          TOTP secret generation and verification
├── rbac.ts          Permission matrix and hasPermission() checker
├── money.ts         BigInt monetary utilities
├── net-worth.ts     Net worth calculation
├── budget.ts        Budget progress calculations
├── goal.ts          Goal projection math
├── categorize.ts    Plaid category → budget category mapping
├── logger.ts        Shared Pino logger with secret redaction
├── schemas/         Zod validation schemas
│   ├── auth.ts
│   ├── account.ts
│   ├── transaction.ts
│   ├── budget.ts
│   ├── goal.ts
│   ├── insight.ts
│   └── index.ts
├── ai-tools/        Claude tool definitions
│   ├── definitions.ts
│   ├── types.ts
│   └── index.ts
└── __tests__/       Unit tests
    ├── crypto.test.ts
    ├── totp.test.ts
    ├── rbac.test.ts
    ├── money.test.ts
    ├── net-worth.test.ts
    ├── budget.test.ts
    ├── goal.test.ts
    └── categorize.test.ts
```

#### `crypto.ts`
`encrypt(plaintext, keyHex)` and `decrypt(ciphertext, keyHex)`:
- Uses Node's built-in `crypto` module
- AES-256-GCM algorithm (authenticated encryption — detects tampering)
- Random 12-byte IV generated per encryption (stored with ciphertext as `iv:authTag:ciphertext`)
- `keyHex` is a 64-character hex string (32 bytes) loaded from environment variables

Used to encrypt Plaid access tokens and TOTP secrets before storing them in the database.

#### `totp.ts`
`generateTotpSecret()` creates a new TOTP secret using the `otpauth` library:
- Returns both the raw secret (for storage after encryption) and an `otpauth://` URI (for the QR code)

`verifyTotpCode(secret, code)` validates a 6-digit code against the stored secret, with a ±1 window to account for clock drift.

#### `rbac.ts`
Defines the permission matrix as a TypeScript `Map<Role, Set<Permission>>`:

```
OWNER  → { org.admin, members.manage, data.write.any, data.read.any, insights.generate, audit.read, ... }
ADMIN  → { members.manage, data.write.any, data.read.any, insights.generate, audit.read, ... }
MEMBER → { data.write.own, data.read.own, insights.generate, ... }
VIEWER → { data.read.own, ... }
```

`hasPermission(role, permission)` returns boolean. `requirePermission()` in `apps/web/src/lib/rbac.ts` calls this and throws HTTP errors.

#### `money.ts`
BigInt monetary utilities:
- `toCents(dollars)` — converts a number like `12.50` to BigInt `1250n`
- `centsToDollars(cents)` — converts BigInt `1250n` to number `12.50`
- `formatCurrency(cents)` — converts BigInt `1250n` to string `"$12.50"`
- `percentageBps(amount, basisPoints)` — calculates percentage using integer basis points (10000 bps = 100%), avoiding floating-point arithmetic
- `serializeMoney(obj)` — JSON replacer that converts BigInt values to strings for API responses
- `deserializeMoney(obj)` — JSON reviver that converts numeric strings back to BigInt

#### `net-worth.ts`
`calculateNetWorth(accounts)`:
- Accepts an array of financial accounts with type and balance
- Asset types: `checking`, `savings`, `investment`, `other_asset`
- Liability types: `credit_card`, `loan`, `mortgage`, `other_liability`
- Returns `{ totalAssets, totalLiabilities, netWorth, breakdown }` all as BigInt cents

This is a pure function with no side effects, making it trivial to unit test with fast-check property-based testing.

#### `budget.ts`
`calculateBudgetProgress(budget, categories, transactions)`:
- Takes the budget definition and current month's transactions
- Groups transactions by category
- Returns progress percentage and remaining amount per category
- Handles rollover logic (unused budget from previous month carries forward)

`isOverBudget(category)` returns whether spending has exceeded the limit.

#### `goal.ts`
`projectGoal(goal, currentBalance)`:
- `daysRemaining` — calendar days until `targetDate`
- `progressPercent` — current balance / target as a percentage
- `isOnTrack` — whether the current contribution rate will hit the target by the deadline
- `projectedCompletionDate` — when the goal will be reached at the current contribution rate

#### `categorize.ts`
`mapPlaidCategory(plaidCategory)`:
Plaid returns hierarchical category arrays like `["Food and Drink", "Restaurants"]`. This function maps them to the app's flat category labels used in budgets (e.g., `"Dining Out"`, `"Groceries"`, `"Entertainment"`). Falls back to `"Other"` for unmapped categories.

#### `schemas/`
Zod schemas shared between frontend and backend. Using the same schema on both ends ensures that:
1. API route handlers validate incoming requests with the exact schema
2. TypeScript types on the frontend match what the API actually accepts
3. Any validation error is caught at the boundary, not deep in business logic

Each file exports:
- Input schema (for parsing request bodies)
- Output schema (for serializing responses — whitelists fields, never leaks internal data)
- Inferred TypeScript types

#### `ai-tools/definitions.ts`
The six tool definitions passed to `anthropic.messages.create()`. Each definition follows Anthropic's tool spec format:
- `name` — machine-readable identifier
- `description` — what the tool does (Claude reads this to decide when to call it)
- `input_schema` — JSON Schema defining the parameters Claude must provide

#### `ai-tools/types.ts`
TypeScript interfaces for tool inputs and outputs. These ensure the tool implementations in `apps/worker/src/lib/insight-tools.ts` return correctly typed data.

---

### `packages/ui/` — Shared React Components

shadcn/ui components copied directly into the repository. The "copy rather than install" approach means the components are fully customizable without fighting a versioned dependency.

```
packages/ui/src/
├── components/
│   ├── button.tsx      Primary, secondary, outline, ghost, destructive variants
│   ├── input.tsx       Text input with focus ring, error state
│   ├── card.tsx        Card + CardHeader + CardContent + CardFooter
│   ├── dialog.tsx      Modal dialog (Radix Dialog primitive)
│   ├── label.tsx       Form label with htmlFor
│   ├── badge.tsx       Pill badge (default, success, warning, destructive variants)
│   ├── progress.tsx    Horizontal progress bar (0–100%)
│   ├── select.tsx      Dropdown select (Radix Select primitive)
│   ├── separator.tsx   Horizontal or vertical divider
│   └── skeleton.tsx    Loading placeholder (animated pulse)
└── lib/
    └── utils.ts        cn() — merges Tailwind class strings (clsx + tailwind-merge)
```

All components use Tailwind CSS classes for styling and follow the shadcn/ui design system (CSS variables for theming, Radix UI for accessibility primitives).

---

### `packages/config/` — Shared Configuration

No runtime code — only configuration files consumed by the TypeScript and ESLint toolchain.

```
packages/config/
├── eslint.base.js      Base ESLint config extended by all workspaces
├── tsconfig.base.json  Base TypeScript config extended by all workspaces
└── package.json
```

#### `eslint.base.js`
Extends `@typescript-eslint/recommended-type-checked` for type-aware linting. Includes the `eslint-plugin-security` rules to catch common security issues (e.g., `security/detect-object-injection`, `security/detect-non-literal-regexp`). Formatting rules are minimal (Prettier handles formatting).

#### `tsconfig.base.json`
Strict TypeScript configuration:
- `"strict": true` — enables all strict checks
- `"noUncheckedIndexedAccess": true` — array/object indexing returns `T | undefined`, forcing null checks
- `"exactOptionalPropertyTypes": true` — `{a?: string}` cannot have `{a: undefined}`, only omit the key
- `"target": "ES2020"` — modern output, compatible with Node 20
- `"moduleResolution": "bundler"` — matches how Next.js and Vite resolve modules

---

## docs/

Documentation written during Phase 0 and updated throughout the build.

```
docs/
├── ARCHITECTURE.md        System context, component diagrams, ERD, sequence diagrams, threat model
├── SECURITY.md            Security posture: encryption, RBAC, audit logging, headers, PII handling
├── ROADMAP.md             9-phase build plan with acceptance criteria and Gantt chart
├── DEFERRED.md            Features explicitly out of scope for v0.1.0 with rationale
├── RUNBOOK.md             Operational playbook: backup/restore, incident response, key rotation
├── PLAID_PRODUCTION.md    Steps to move from Plaid sandbox to production access
├── QA_CHECKLIST.md        Manual testing sign-off checklist with screenshots
└── decisions/
    ├── 0001-monorepo.md           Why pnpm workspaces + Turborepo over alternatives
    ├── 0002-bigint-money.md       Why BigInt cents over Decimal.js or float
    ├── 0003-plaid-encryption.md   Why AES-256-GCM over column-level encryption
    ├── 0004-authjs.md             Why Auth.js v5 over custom JWT or Clerk
    ├── 0005-bullmq.md             Why BullMQ over SQS, Inngest, or cron jobs
    └── 0006-agentic-tools.md      Why tool-use loop over a single-shot prompt
```

Each ADR in `decisions/` follows the format: **Context** (the problem), **Decision** (what was chosen), **Consequences** (trade-offs accepted).

---

## .github/

```
.github/
└── workflows/
    ├── ci.yml          Runs on every PR: lint, typecheck, unit tests
    └── security.yml    Runs weekly: npm audit, Semgrep, Gitleaks
```

**`ci.yml`** — The standard CI pipeline:
1. Checkout code
2. Install Node.js 20 + pnpm
3. `pnpm install`
4. `pnpm turbo lint`
5. `pnpm turbo typecheck`
6. `pnpm turbo test` (starts a Postgres container for integration tests)

**`security.yml`** — Security scanning:
1. `pnpm audit --audit-level=high` — checks for known vulnerabilities in npm packages
2. Semgrep with OWASP Top 10 rules — static analysis for common vulnerability patterns
3. Gitleaks — scans for accidentally committed secrets

---

## Key Patterns Across the Codebase

### Money is always BigInt
```typescript
// Good — BigInt, no precision loss
const balance: BigInt = 485230n  // $4,852.30

// Never — floating point
const balance: number = 4852.30  // 4852.299999... in IEEE 754
```

### All database access is org-scoped
```typescript
// Always use orgClient, never the raw db client in route handlers
const db = orgClient(orgId)  // Sets RLS session variable
const accounts = await db.financialAccount.findMany()  // Only returns this org's accounts
```

### RBAC before any business logic
```typescript
export async function POST(req: Request) {
  const ctx = await requirePermission(orgId, 'insights.generate')
  // ctx.userId and ctx.role are now available
  // Reaching here means the user is authenticated and authorized
  const job = await insightsQueue.add(...)
}
```

### Zod at every boundary
```typescript
// Parse input — throws ZodError on invalid data, caught by error handler
const body = CreateTransactionSchema.parse(await req.json())

// Validate Claude's output before persisting
const insight = InsightOutputSchema.parse(claudeResponse)
```

### Pure functions in packages/shared, side effects in apps/
```typescript
// packages/shared/src/net-worth.ts — pure, testable, no imports from db
export function calculateNetWorth(accounts: Account[]): NetWorthResult { ... }

// apps/worker/src/workers/net-worth-worker.ts — loads data, calls pure function, persists
const accounts = await db.financialAccount.findMany(...)
const result = calculateNetWorth(accounts)  // pure function call
await db.netWorthSnapshot.upsert(...)
```
