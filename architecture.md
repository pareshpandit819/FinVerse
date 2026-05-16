# Architecture: FinVerse Enterprise Financial Dashboard

This document provides a technical overview of the FinVerse application demonstrated in Task 4. It summarizes the system architecture, main data model, frontend and backend design, AI Financial Coach call flow, background processing, security boundaries, and a recommended Google Cloud Platform deployment approach.

---

## 1. System Architecture

FinVerse follows a modular monorepo architecture. The application is built around a Next.js web frontend, Next.js API routes, a Prisma/PostgreSQL data layer, and a Fastify worker service for background processing.

### High-Level Topology

```text
┌─────────────────────────────────────────────────────────┐
│ User Browser                                            │
│ - Dashboard pages                                       │
│ - AI Financial Coach UI                                 │
│ - Financial context panels and charts                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Next.js Web App - apps/web                              │
│ - App Router pages                                      │
│ - React dashboard components                            │
│ - Internal API route handlers                           │
│ - Authentication and permission checks                  │
└────────────────────────┬────────────────────────────────┘
                         │ Prisma Client
                         ▼
┌─────────────────────────────────────────────────────────┐
│ PostgreSQL Database                                     │
│ - Users and organizations                               │
│ - Transactions                                          │
│ - Budgets and goals                                     │
│ - Net worth snapshots                                   │
│ - Credit, debt, alerts, insights, and forecasts         │
└─────────────────────────────────────────────────────────┘

Background Processing:

┌─────────────────────────────────────────────────────────┐
│ Fastify Worker - apps/worker                            │
│ - Queue-based background jobs                           │
│ - Net worth snapshot jobs                               │
│ - Insight jobs                                          │
│ - Scheduled financial processing                        │
└────────────────────────┬────────────────────────────────┘
                         │ BullMQ
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Redis                                                   │
│ - Job queues                                            │
│ - Worker coordination                                   │
└─────────────────────────────────────────────────────────┘
Key Modules
Next.js Web App (apps/web)
Provides the dashboard interface, AI Financial Coach page, charts, financial summaries, and browser-facing API routes.

Coach API Route (apps/web/src/app/api/coach/route.ts)
Handles the Task 4 AI Financial Coach backend flow. It validates the request, checks permissions, reads recent transactions using Prisma, computes financial evidence, and returns a local-rule response.

AI Financial Coach Page (apps/web/src/app/(dashboard)/coach/page.tsx)
Provides the chat-style interface where users ask financial questions. It sends messages to /api/coach and displays the returned answer and financial context.

Database Package (packages/db)
Contains the Prisma schema, generated Prisma client, migrations, and database utilities.

Worker Service (apps/worker)
Runs background jobs using Fastify, Redis, and BullMQ.

Shared Packages (packages/shared, packages/ui, packages/config)
Contain reusable schemas, utilities, UI components, and configuration shared across the monorepo.

2. AI Financial Coach Pipeline and Call Flow
The demonstrated Task 4 feature is the AI Financial Coach. The coach is implemented as a local-rule financial assistant. It does not use Plaid, Anthropic, Claude, or RAG.

Coach Request Lifecycle
User opens the AI Financial Coach page.

User enters a question or selects a starter prompt.

The frontend sends a POST /api/coach request.

The backend validates the request body.

The backend checks the user permission: transaction.read.own.

The backend queries recent transactions using Prisma.

The backend computes financial evidence:

Total spending

Total income

Net cash flow

Pending transaction count

Top spending categories

Top merchants

Subscription-like charges

Large transactions

The backend builds a deterministic local-rule response.

The API returns:

reply

usedModel: "local-rules"

evidence

The frontend renders the assistant response and the Financial Context panel.

Coach Call Flow Diagram
User Question
   |
   v
AI Financial Coach Page
apps/web/src/app/(dashboard)/coach/page.tsx
   |
   | POST /api/coach
   v
Coach API Route
apps/web/src/app/api/coach/route.ts
   |
   | requirePermission("transaction.read.own")
   v
Prisma Transaction Query
   |
   v
Local Financial Analysis
   |
   | summarize categories
   | summarize merchants
   | detect subscriptions
   | detect large transactions
   | calculate cash flow
   v
Local Rule Response Builder
   |
   v
JSON Response
reply + usedModel + evidence
   |
   v
Frontend Chat UI + Financial Context Panel
Important Clarification
The demonstrated AI Financial Coach does not call any external AI provider. The response is generated from local transaction analysis and deterministic financial rules. The API response identifies this mode as:

usedModel: "local-rules"
3. Data Model and Persistence
FinVerse uses Prisma with PostgreSQL. The database schema stores monetary values as BigInt cents to avoid floating-point precision errors in financial calculations.

Core Data Entities
The main data entities include:

Organization
User
Membership
Session
MfaSecret
AuditLog
FinancialAccount
Transaction
Holding
Security
Liability
NetWorthSnapshot
Goal
Budget
BudgetCategory
Insight
CreditScore
CreditAccount
CreditHistory
DebtAccount
PayoffStrategy
PayoffPlan
AlertRule
AlertHistory
SpendingForecast
Transaction Model Usage in the Coach
The AI Financial Coach mainly depends on the Transaction model. The route reads transaction fields such as:

organizationId
amount
isoCurrencyCode
date
name
merchantName
customCategory
pending
createdAt
These fields are used to calculate spending, income, merchants, categories, subscriptions, and large transactions.

Money Representation
FinVerse stores money in minor units:

BigInt cents
This is important for financial correctness because it avoids decimal rounding issues.

Multi-Tenant Data Scoping
The application uses organizations and memberships to scope user access. Financial records are associated with an organization, and API routes check permissions before returning sensitive transaction-derived information.

4. Frontend and Backend Details
Frontend Details
The frontend is implemented in apps/web using:

Next.js 15
React 18
TypeScript
Tailwind CSS
TanStack Query
Recharts
Shared UI components
The frontend is responsible for:

- Rendering dashboard pages
- Managing user interactions
- Calling internal API routes
- Displaying financial summaries
- Rendering charts and cards
- Displaying the AI Financial Coach chat interface
- Showing the Financial Context panel returned by /api/coach
The AI Financial Coach page manages local state for:

messages
input
loading
error
evidence
usedModel
It sends the user’s messages to /api/coach and renders the returned assistant reply.

Backend Details
The backend logic is split between:

Next.js API routes inside apps/web
Fastify worker service inside apps/worker
The Coach API route performs the main Task 4 backend work. It:

- Parses request JSON
- Validates organizationId
- Validates messages
- Checks transaction.read.own permission
- Queries recent transactions through Prisma
- Computes transaction-based financial evidence
- Builds a local-rule response
- Returns reply, usedModel, and evidence
Worker Details
The worker service is located in:

apps/worker
It uses:

Fastify
BullMQ
Redis
ioredis
Zod
TypeScript
The worker supports background processing such as:

- Queue-based jobs
- Net worth snapshot jobs
- Insight jobs
- Scheduled financial processing
- Async maintenance workflows
The general worker lifecycle is:

Application event or scheduled task
   |
   v
Job added to BullMQ queue
   |
   v
Worker consumes job
   |
   v
Input is validated
   |
   v
Worker performs async operation
   |
   v
Worker writes results to PostgreSQL
5. Security and Access Boundaries
FinVerse handles financial data, so access control and secure configuration are important parts of the architecture.

Authentication
The application uses session-based authentication with support for Google OAuth and MFA.

Authorization
Sensitive financial API routes perform permission checks before returning data. For the AI Financial Coach route, the required permission is:

transaction.read.own
This ensures that transaction-derived insights are only generated for authorized users.

Secret Management
Sensitive values should not be hardcoded. These include:

Database credentials
Auth secrets
OAuth credentials
MFA encryption key
SMTP credentials
Monitoring keys
Observability endpoints
Locally, these are configured through environment variables. In production, they should be stored in Google Secret Manager.

Financial Data Protection
Financial data is protected through:

- Organization-level scoping
- Permission checks before database access
- Server-side API access
- Session-based authentication
- Secure environment variable handling
- Audit logging for important actions
6. Google Cloud Platform Deployment
The repository uses Docker Compose for local development. A complete GCP deployment setup is not already implemented in the repo, so this section describes a recommended deployment plan based on the existing architecture.

Recommended GCP Deployment Architecture
┌─────────────────────────────────────────────────────────┐
│ User Browser                                            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud Run: Next.js Web App                              │
│ - Dashboard UI                                          │
│ - API routes                                            │
│ - AI Financial Coach endpoint                           │
└────────────────────────┬────────────────────────────────┘
                         │ DATABASE_URL
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud SQL: PostgreSQL                                   │
│ - Application data                                      │
│ - Transactions                                          │
│ - Budgets, goals, insights, forecasts                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Cloud Run: Fastify Worker                               │
│ - Background jobs                                       │
│ - Scheduled processing                                  │
│ - Queue consumers                                       │
└────────────────────────┬────────────────────────────────┘
                         │ REDIS_URL
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Memorystore for Redis                                   │
│ - BullMQ queues                                         │
│ - Worker coordination                                   │
└─────────────────────────────────────────────────────────┘

Supporting GCP Services:
- Secret Manager for environment variables and credentials
- Artifact Registry for container images
- Cloud Build for build and deployment
- Cloud Logging for runtime logs
- Cloud Monitoring for metrics and alerts
GCP Service Mapping
FinVerse Component	GCP Service
Next.js web app	Cloud Run
Fastify worker	Cloud Run
PostgreSQL database	Cloud SQL for PostgreSQL
Redis queues	Memorystore for Redis
Environment secrets	Secret Manager
Container images	Artifact Registry
Build and deployment	Cloud Build
Runtime logs	Cloud Logging
Metrics and alerts	Cloud Monitoring
Deployment Steps
Authenticate with Google Cloud and set the project.

gcloud auth login
gcloud config set project YOUR_PROJECT_ID
Enable required APIs.

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  redis.googleapis.com
Create an Artifact Registry repository.

gcloud artifacts repositories create finverse-repo \
  --repository-format=docker \
  --location=us-central1
Create Cloud SQL for PostgreSQL.

gcloud sql instances create finverse-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1
Create the application database and database user.

gcloud sql databases create efd_prod \
  --instance=finverse-postgres

gcloud sql users create efd_user \
  --instance=finverse-postgres \
  --password=YOUR_STRONG_PASSWORD
Create Redis using Memorystore.

gcloud redis instances create finverse-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
Store production secrets in Secret Manager.

Required core secrets:

AUTH_SECRET
NEXTAUTH_SECRET
DATABASE_URL
DIRECT_URL
REDIS_URL
MFA_SECRET_ENCRYPTION_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
Optional secrets:

SENTRY_DSN
OTEL_EXPORTER_OTLP_ENDPOINT
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
EMAIL_FROM
Build and deploy the Next.js web app to Cloud Run.

The web app should run:

pnpm --filter @repo/web build
pnpm --filter @repo/web start
Build and deploy the Fastify worker to Cloud Run.

The worker should run:

pnpm --filter @repo/worker build
pnpm --filter @repo/worker start
Run Prisma migrations against the Cloud SQL database.

DATABASE_URL="YOUR_DATABASE_URL" \
DIRECT_URL="YOUR_DIRECT_URL" \
pnpm --filter @repo/db db:migrate:deploy
Configure the Google OAuth callback URL.

https://YOUR_WEB_URL/api/auth/callback/google
Verify production health.

Check that:

- Web app starts successfully
- Database connection works
- Prisma migrations are applied
- Redis connection works
- Worker starts successfully
- Auth login works
- Dashboard pages load
- /api/coach responds successfully
- Logs appear in Cloud Logging


7. Final Summary
FinVerse is a monorepo-based enterprise financial dashboard. The frontend is a Next.js application in apps/web, the background service is a Fastify worker in apps/worker, persistence is handled through Prisma and PostgreSQL, and background jobs use Redis with BullMQ.

The demonstrated Task 4 feature is the AI Financial Coach. The coach page sends questions to /api/coach. The backend checks permissions, reads recent transactions, computes spending and cash-flow evidence, identifies subscriptions and large transactions, and returns a deterministic local-rule response.

The demonstrated coach route does not call Plaid, Anthropic, Claude, or use RAG. For GCP deployment, the recommended setup is Cloud Run for the web app and worker, Cloud SQL for PostgreSQL, Memorystore for Redis, Secret Manager for secrets, Artifact Registry for images, and Cloud Build for CI/CD.
