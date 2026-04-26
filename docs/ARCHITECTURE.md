# Architecture — Enterprise Financial Dashboard

## 1. System Context Diagram

```mermaid
C4Context
  title System Context — Enterprise Financial Dashboard

  Person(user, "End User", "Individual or team member managing finances")
  Person(admin, "Org Admin", "Manages users, roles, and connected institutions")

  System(efinDash, "Enterprise Financial Dashboard", "Aggregates accounts, computes net worth, tracks goals/budgets, surfaces AI insights")

  System_Ext(plaid, "Plaid", "Bank connectivity — OAuth Link, transaction sync, investments, liabilities")
  System_Ext(claude, "Anthropic Claude API", "Sonnet 4.6 for agentic insights, Haiku 4.5 for classification")
  System_Ext(googleOAuth, "Google OAuth 2.0", "Social sign-in identity provider")
  System_Ext(smtp, "SMTP / Mailhog (dev)", "Magic-link and notification emails")
  System_Ext(sentry, "Sentry", "Error tracking and performance monitoring")
  System_Ext(otel, "OpenTelemetry Collector", "Distributed tracing export")

  Rel(user, efinDash, "Uses", "HTTPS")
  Rel(admin, efinDash, "Manages", "HTTPS")
  Rel(efinDash, plaid, "Connects accounts, syncs transactions", "HTTPS / webhooks")
  Rel(efinDash, claude, "Generates AI insights", "HTTPS")
  Rel(efinDash, googleOAuth, "Delegates auth", "OAuth 2.0 / OIDC")
  Rel(efinDash, smtp, "Sends emails", "SMTP/TLS")
  Rel(efinDash, sentry, "Reports errors", "HTTPS")
  Rel(efinDash, otel, "Emits traces", "OTLP/gRPC")
  Rel(plaid, efinDash, "Delivers webhooks", "HTTPS POST + JWT verification")
```

---

## 2. Component Diagram

```mermaid
C4Component
  title Component Diagram — Enterprise Financial Dashboard

  Container_Boundary(web, "apps/web — Next.js 15 App Router") {
    Component(ui, "React UI", "TypeScript + Tailwind + shadcn/ui", "Renders dashboard, charts, forms")
    Component(bff, "BFF Route Handlers", "Next.js Route Handlers", "Auth-gated API surface for the browser")
    Component(authMod, "Auth Module", "Auth.js + TOTP", "Session, MFA, RBAC middleware")
    Component(plaidLink, "Plaid Link Handler", "plaid-node + Next.js", "Generates link tokens, exchanges public tokens")
  }

  Container_Boundary(worker, "apps/worker — Fastify / NestJS") {
    Component(webhookSvc, "Plaid Webhook Service", "Fastify", "Verifies Plaid JWTs, dispatches events to queues")
    Component(syncWorker, "Transaction Sync Worker", "BullMQ consumer", "Idempotent cursor-based transaction pull")
    Component(insightWorker, "AI Insight Worker", "BullMQ consumer + Claude SDK", "Agentic insight generation loop")
    Component(snapshotWorker, "Net Worth Snapshot Worker", "BullMQ cron", "Daily snapshot job")
  }

  Container_Boundary(pkgDb, "packages/db") {
    Component(prisma, "Prisma Client", "Prisma ORM + RLS", "Type-safe DB access, Row-Level Security")
    Component(migrations, "Migrations", "Prisma Migrate", "Schema versioning")
  }

  Container_Boundary(pkgShared, "packages/shared") {
    Component(netWorth, "Net Worth Calculator", "Pure TS", "Asset − liability math, multi-currency ready")
    Component(budgetCalc, "Budget Calculator", "Pure TS", "Category caps, rollover logic")
    Component(goalCalc, "Goal Projection", "Pure TS", "Projected completion from contribution rate")
    Component(crypto, "Crypto Helpers", "Node crypto / AES-256-GCM", "Plaid token encryption/decryption")
    Component(validation, "Zod Schemas", "Zod", "Shared request/response validation types")
  }

  ContainerDb(postgres, "PostgreSQL 16", "Primary store — users, accounts, transactions, insights")
  ContainerDb(redis, "Redis 7", "BullMQ queues, session store, rate-limit counters")

  Rel(ui, bff, "API calls", "Fetch / TanStack Query")
  Rel(bff, authMod, "Session check + RBAC")
  Rel(bff, prisma, "DB reads/writes")
  Rel(bff, plaidLink, "Link token & exchange")
  Rel(webhookSvc, redis, "Enqueue sync jobs")
  Rel(syncWorker, prisma, "Upsert transactions")
  Rel(insightWorker, prisma, "Read context, write insights")
  Rel(snapshotWorker, netWorth, "Compute snapshot")
  Rel(snapshotWorker, prisma, "Persist snapshot")
  Rel(prisma, postgres, "TCP")
  Rel(redis, syncWorker, "Job dispatch")
```

---

## 3. Data Model ERD

```mermaid
erDiagram
  Organization {
    uuid id PK
    string name
    string slug UK
    timestamptz createdAt
    timestamptz updatedAt
  }

  User {
    uuid id PK
    string email UK
    string name
    string avatarUrl
    timestamptz emailVerifiedAt
    timestamptz createdAt
    timestamptz updatedAt
  }

  Membership {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    Role role
    timestamptz createdAt
  }

  Session {
    uuid id PK
    uuid userId FK
    string sessionToken UK
    timestamptz expires
    string ipAddress
    string userAgent
  }

  MfaSecret {
    uuid id PK
    uuid userId FK
    string encryptedSecret
    bool verified
    timestamptz createdAt
  }

  AuditLog {
    uuid id PK
    uuid userId FK
    uuid organizationId FK
    string action
    string entityType
    uuid entityId
    jsonb before
    jsonb after
    string ipAddress
    timestamptz createdAt
  }

  PlaidItem {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    string encryptedAccessToken
    string itemId UK
    string institutionId
    string institutionName
    string status
    timestamptz consentExpiresAt
    timestamptz lastSyncedAt
    string transactionCursor
    timestamptz createdAt
    timestamptz updatedAt
  }

  PlaidAccount {
    uuid id PK
    uuid plaidItemId FK
    uuid organizationId FK
    string accountId UK
    string name
    string officialName
    string type
    string subtype
    string mask
    bigint balanceCurrent
    bigint balanceAvailable
    bigint balanceLimit
    string isoCurrencyCode
    timestamptz updatedAt
  }

  Transaction {
    uuid id PK
    uuid plaidAccountId FK
    uuid organizationId FK
    string transactionId UK
    bigint amount
    string isoCurrencyCode
    date date
    string name
    string merchantName
    string paymentChannel
    string[] plaidCategories
    string customCategory
    bool pending
    jsonb metadata
    timestamptz createdAt
    timestamptz updatedAt
  }

  Holding {
    uuid id PK
    uuid plaidAccountId FK
    uuid securityId FK
    uuid organizationId FK
    decimal quantity
    bigint institutionValue
    bigint costBasis
    string isoCurrencyCode
    timestamptz updatedAt
  }

  Security {
    uuid id PK
    string plaidSecurityId UK
    string name
    string tickerSymbol
    string type
    string isoCurrencyCode
    bigint closePrice
    date closePriceAsOf
    timestamptz updatedAt
  }

  Liability {
    uuid id PK
    uuid plaidAccountId FK
    uuid organizationId FK
    string type
    bigint lastPaymentAmount
    date lastPaymentDate
    bigint minimumPaymentAmount
    date nextPaymentDueDate
    jsonb metadata
    timestamptz updatedAt
  }

  NetWorthSnapshot {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    bigint totalAssets
    bigint totalLiabilities
    bigint netWorth
    date snapshotDate
    jsonb breakdown
    timestamptz createdAt
  }

  Goal {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    string name
    bigint targetAmount
    bigint currentAmount
    date targetDate
    decimal contributionRate
    string[] linkedAccountIds
    bool isCompleted
    timestamptz createdAt
    timestamptz updatedAt
  }

  Budget {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    string name
    int month
    int year
    bool rollover
    timestamptz createdAt
    timestamptz updatedAt
  }

  BudgetCategory {
    uuid id PK
    uuid budgetId FK
    string category
    bigint limitAmount
    bigint spentAmount
    timestamptz updatedAt
  }

  Insight {
    uuid id PK
    uuid organizationId FK
    uuid userId FK
    string type
    string title
    text body
    jsonb toolCallLog
    string modelId
    string promptHash
    int inputTokens
    int outputTokens
    bool helpful
    timestamptz generatedAt
    timestamptz expiresAt
  }

  Organization ||--o{ Membership : "has"
  User ||--o{ Membership : "belongs to"
  User ||--o{ Session : "has"
  User ||--o{ MfaSecret : "has"
  User ||--o{ AuditLog : "generates"
  Organization ||--o{ PlaidItem : "owns"
  User ||--o{ PlaidItem : "linked by"
  PlaidItem ||--o{ PlaidAccount : "has"
  PlaidAccount ||--o{ Transaction : "has"
  PlaidAccount ||--o{ Holding : "has"
  PlaidAccount ||--|| Liability : "may have"
  Holding }o--|| Security : "references"
  Organization ||--o{ NetWorthSnapshot : "has"
  Organization ||--o{ Goal : "has"
  User ||--o{ Goal : "owns"
  Organization ||--o{ Budget : "has"
  Budget ||--o{ BudgetCategory : "contains"
  Organization ||--o{ Insight : "has"
  User ||--o{ Insight : "receives"
```

---

## 4. Sequence Diagrams

### 4.1 Plaid Link Flow

```mermaid
sequenceDiagram
  actor U as User
  participant FE as Next.js Frontend
  participant BFF as BFF Route Handler
  participant W as Worker Service
  participant PL as Plaid API
  participant DB as PostgreSQL

  U->>FE: Click "Connect Account"
  FE->>BFF: POST /api/plaid/link-token
  BFF->>PL: POST /link/token/create (user_id, products)
  PL-->>BFF: { link_token }
  BFF-->>FE: { link_token }
  FE->>U: Opens Plaid Link modal (link_token)
  U->>PL: Completes institution auth
  PL-->>FE: onSuccess(public_token, metadata)
  FE->>BFF: POST /api/plaid/exchange (public_token)
  BFF->>PL: POST /item/public_token/exchange
  PL-->>BFF: { access_token, item_id }
  BFF->>DB: INSERT PlaidItem (encrypted access_token)
  BFF->>W: Enqueue INITIAL_SYNC job (itemId)
  BFF-->>FE: { itemId, status: "syncing" }
  W->>PL: GET /accounts/get, /transactions/sync
  W->>DB: UPSERT PlaidAccount, Transaction (idempotent)
  W-->>FE: WebSocket / SSE push "sync complete"
```

### 4.2 Transaction Sync (Cursor Pattern)

```mermaid
sequenceDiagram
  participant Q as BullMQ Queue
  participant SW as Sync Worker
  participant PL as Plaid API
  participant DB as PostgreSQL

  Q->>SW: SYNC_UPDATES_AVAILABLE { itemId }
  SW->>DB: SELECT cursor FROM PlaidItem WHERE id = itemId
  loop until hasMore = false
    SW->>PL: POST /transactions/sync { access_token, cursor }
    PL-->>SW: { added[], modified[], removed[], next_cursor, has_more }
    SW->>DB: BEGIN TRANSACTION
    SW->>DB: UPSERT added + modified Transactions
    SW->>DB: DELETE removed Transaction IDs
    SW->>DB: UPDATE PlaidItem SET cursor = next_cursor
    SW->>DB: COMMIT
  end
  SW->>Q: Enqueue NET_WORTH_SNAPSHOT job
```

### 4.3 Net Worth Calculation

```mermaid
sequenceDiagram
  participant CRON as Cron Job (daily)
  participant NWW as Net Worth Worker
  participant DB as PostgreSQL
  participant CALC as NetWorthCalculator (packages/shared)

  CRON->>NWW: Trigger NET_WORTH_SNAPSHOT
  NWW->>DB: SELECT balances FROM PlaidAccount WHERE orgId = X
  NWW->>DB: SELECT holdings + security prices FROM Holding, Security
  NWW->>DB: SELECT liabilities FROM Liability
  NWW->>CALC: calculate({ accounts, holdings, liabilities })
  CALC-->>NWW: { totalAssets, totalLiabilities, netWorth, breakdown }
  NWW->>DB: INSERT NetWorthSnapshot (date = today, idempotent on date+userId)
  NWW->>DB: UPDATE Goal.currentAmount for linked accounts
```

### 4.4 AI Insight Generation (Agentic Loop)

```mermaid
sequenceDiagram
  participant CRON as Weekly Cron / On-Demand
  participant IW as Insight Worker
  participant CLAUDE as Anthropic Claude API
  participant TOOLS as Tool Functions (packages/shared)
  participant DB as PostgreSQL

  CRON->>IW: Trigger GENERATE_INSIGHTS { userId, orgId }
  IW->>DB: CHECK daily token budget for userId
  IW->>CLAUDE: messages.create(system_prompt, tools=[...], model=claude-sonnet-4-6)
  loop tool_use stop_reason (max 8 iterations)
    CLAUDE-->>IW: { stop_reason: "tool_use", tool_calls: [...] }
    IW->>TOOLS: dispatch tool call (e.g. get_spending_by_category)
    TOOLS->>DB: Aggregated query (no raw PII)
    TOOLS-->>IW: Typed result
    IW->>CLAUDE: tool_result message
  end
  CLAUDE-->>IW: { stop_reason: "end_turn", content: insight_text }
  IW->>IW: Validate output against Zod InsightSchema
  IW->>DB: INSERT Insight (body, toolCallLog, modelId, promptHash, tokens)
  IW->>DB: UPDATE token budget usage
```

---

## 5. Threat Model (STRIDE)

| # | Asset | Threat | STRIDE Category | Likelihood | Impact | Mitigation |
|---|-------|--------|-----------------|------------|--------|------------|
| T-01 | Plaid access tokens | Token exfiltration via DB breach | Information Disclosure | Medium | Critical | AES-256-GCM encryption at rest; key in env / AWS KMS; tokens never logged |
| T-02 | Session tokens | Session hijacking via XSS | Elevation of Privilege | Medium | High | HttpOnly+Secure cookies; CSP; session rotation on privilege change |
| T-03 | Auth endpoints | Credential stuffing / brute force | Denial of Service | High | Medium | Rate limiting (IP + user); TOTP MFA; account lockout after N failures |
| T-04 | Plaid webhooks | Replay attack / spoofed webhook | Spoofing | Medium | High | Verify Plaid JWT signature on every request; idempotency key deduplication |
| T-05 | AI insight endpoint | Prompt injection via merchant strings | Tampering | Low | Medium | Agent only receives aggregated/derived data, never raw merchant strings by default |
| T-06 | Multi-tenant DB | Cross-org data read | Information Disclosure | Low | Critical | Postgres Row-Level Security; every query includes org_id; RLS test suite |
| T-07 | API endpoints | CSRF on state-mutating calls | Tampering | Medium | High | SameSite=Strict cookies; CSRF token for non-GET; `next-safe` headers |
| T-08 | Env secrets | Secrets committed to git | Information Disclosure | Medium | Critical | Gitleaks in CI pre-commit; `.env` in `.gitignore`; `.env.example` documents vars |
| T-09 | Dependencies | Supply-chain compromise | Tampering | Low | High | `npm audit` + Semgrep in CI; lockfile committed; Dependabot |
| T-10 | User financial data | Insider access without audit trail | Repudiation | Low | High | AuditLog on every mutation; immutable append-only table; alerts on anomalous admin access |
| T-11 | Claude API | PII leakage to third-party model | Information Disclosure | Low | High | Tool layer returns only aggregated numbers; system prompt instructs no raw data storage |
| T-12 | Redis queue | Job poisoning / queue injection | Tampering | Low | Medium | BullMQ job data validated with Zod on dequeue; Redis requires auth; network-isolated |

---

## 6. Tech Stack Justification

| Concern | Choice | Justification |
|---------|--------|---------------|
| **Monorepo** | pnpm workspaces + Turborepo | Best-in-class caching, workspace hoisting; Turborepo remote cache for CI speed |
| **Frontend framework** | Next.js 15 App Router | RSC reduces client bundle; file-based routing; built-in API routes for BFF; Vercel-aligned but portable |
| **UI library** | shadcn/ui + Tailwind | Copy-owned components (no versioning hell); accessible primitives; Tailwind tokens for design consistency |
| **Data fetching** | TanStack Query v5 | Server-state cache, background refetch, optimistic updates; pairs well with RSC for hydration |
| **Charts** | Recharts | React-native, composable, accessible; sufficient for financial sparklines and trend charts |
| **Backend jobs** | Fastify service (apps/worker) | Lightweight, schema-first, excellent TypeScript support; keeps long-running work off Next.js edge |
| **ORM** | Prisma | Type-safe queries; migration tooling; RLS support via `$executeRaw` for policy DDL |
| **Queue** | BullMQ + Redis | Battle-tested; per-queue concurrency; delayed jobs; retry with backoff; UI (Bull Board) |
| **Auth** | Auth.js v5 | Framework-agnostic adapter; Prisma adapter; MFA extensible; avoids rolling custom sessions |
| **AI** | Anthropic Claude (Sonnet 4.6 + Haiku 4.5) | Tool use native; instruction-following for financial guardrails; cost tiering via model selection |
| **Plaid** | plaid-node v14+ | Official SDK; `/transactions/sync` cursor pattern; investment + liabilities support |
| **Money math** | BigInt minor units | Eliminates floating-point rounding errors entirely; safe across all currencies |
| **Observability** | Pino + OpenTelemetry + Sentry | Structured logs (parseable); OTEL vendor-neutral traces; Sentry for exception grouping |
| **Testing** | Vitest + Playwright + Supertest + MSW | Vitest fast with TS; Playwright for real-browser E2E; MSW intercepts at network for Plaid mocks |
| **CI** | GitHub Actions | Native secrets; matrix builds; Semgrep + Gitleaks available as marketplace actions |
| **Infra (local)** | Docker Compose | Reproducible; Postgres + Redis + Mailhog in one command; health checks prevent race conditions |
| **Infra (prod)** | Terraform stubs for AWS | ECS Fargate (stateless), RDS Multi-AZ, ElastiCache, Secrets Manager, CloudFront; Terraform documents intent without applying |
