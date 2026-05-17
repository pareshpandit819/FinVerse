Architecture: FinVerse Financial Management Platform

1. System Overview

FinVerse is a full-stack financial management platform designed to help users understand, organize, and improve their personal or organizational finances. The application provides a dashboard for accounts, transactions, budgets, goals, net worth, credit, debt payoff, recurring spending, tax estimation, alerts, spending forecasts, trading views, insights, and an AI Coach.

The system is implemented as a TypeScript monorepo. It uses a Next.js web application for the user interface and API routes, a separate worker service for background jobs, a shared database package, reusable UI components, and shared business logic packages.

The main purpose of the application is to centralize financial data and convert it into useful actions. A user can view accounts and transactions, track budgets, monitor financial goals, analyze credit and debt, forecast spending, receive alerts, and use AI-supported features to better interpret their financial data.

 2. High-Level System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ User Browser                                                  │
│ Next.js React UI                                              │
│                                                              │
│ Dashboard modules:                                            │
│ - Accounts                                                    │
│ - Transactions                                                │
│ - Budgets                                                     │
│ - Goals                                                       │
│ - Net Worth                                                   │
│ - Credit                                                      │
│ - Debt                                                        │
│ - Forecast                                                    │
│ - Insights                                                    │
│ - AI Coach                                                    │
│ - Alerts                                                      │
│ - Tax                                                         │
│ - Recurring                                                   │
│ - Heatmap                                                     │
│ - Trading                                                     │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ apps/web                                                      │
│ Next.js App Router                                            │
│                                                              │
│ - Server Components                                           │
│ - Client Components                                           │
│ - API Route Handlers                                          │
│ - Authentication                                              │
│ - Organization context                                        │
│ - RBAC checks                                                 │
│ - Dashboard rendering                                         │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────┐     ┌─────────────────────────┐
│ packages/db                  │     │ packages/shared          │
│ Prisma ORM                   │     │ Shared financial logic   │
│ PostgreSQL schema            │     │ Money helpers            │
│ Generated database client    │     │ Budget logic             │
└───────────────┬──────────────┘     │ Goal logic               │
                │                    │ Net worth logic          │
                ▼                    │ RBAC helpers             │
┌──────────────────────────────┐     │ AI tool schemas          │
│ PostgreSQL                   │     └─────────────────────────┘
│ Main relational data store   │
└──────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ apps/worker                                                   │
│ Fastify + BullMQ worker service                               │
│                                                              │
│ - Background jobs                                             │
│ - Queue processing                                            │
│ - Retryable tasks                                             │
│ - Asynchronous financial workflows                            │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Redis                                                         │
│ Queue backend for BullMQ                                      │
└──────────────────────────────────────────────────────────────┘

3. Monorepo Structure
FinVerse/
├── apps/
│   ├── web/
│   │   ├── src/app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   └── api/
│   │   ├── src/components/
│   │   ├── src/lib/
│   │   └── package.json
│   │
│   └── worker/
│       ├── src/lib/
│       ├── src/queues/
│       ├── src/routes/
│       ├── src/workers/
│       └── package.json
│
├── packages/
│   ├── db/
│   │   └── prisma/schema.prisma
│   ├── shared/
│   │   └── src/
│   ├── ui/
│   └── config/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json

4. Technology Stack
Layer
Technology
Purpose
Monorepo
pnpm workspaces, Turborepo
Organizes apps and shared packages
Frontend
Next.js, React
Dashboard UI and routing
Backend API
Next.js Route Handlers
Browser-facing API endpoints
Worker Backend
Fastify
Worker service runtime
Queue
BullMQ
Background job processing
Queue Store
Redis
Queue state and retries
ORM
Prisma
Type-safe database access
Database
PostgreSQL
Main relational data store
Authentication
Auth.js
User login and session management
Styling
Tailwind CSS, shadcn/ui
Responsive UI system
Charts
Recharts
Financial charts and analytics
Validation
Zod
Input validation
Testing
Vitest, Playwright
Unit and end-to-end tests
Local Services
Docker Compose
PostgreSQL, Redis, and Mailhog

5. Frontend Architecture
The frontend is located in apps/web. It uses the Next.js App Router and separates public authentication pages from protected dashboard pages.
5.1 Dashboard Routes
apps/web/src/app/(dashboard)/
├── accounts/
├── alerts/
├── budgets/
├── coach/
├── credit/
├── dashboard/
├── debt/
├── forecast/
├── goals/
├── heatmap/
├── insights/
├── net-worth/
├── recurring/
├── settings/
├── tax/
├── trading/
├── transactions/
└── layout.tsx

5.2 Main Frontend Modules
Module
Purpose
Dashboard
Main financial overview with summaries and charts
Accounts
Account management and account-level financial details
Transactions
Transaction list, transaction entry, and categorization
Budgets
Budget tracking and category-level spending limits
Goals
Savings and financial goal progress
Net Worth
Asset, liability, and net worth visualization
Credit
Credit score, credit accounts, and credit factors
Debt
Debt accounts and payoff strategy planning
Forecast
Spending prediction and projected financial trend views
Insights
Generated financial insights and feedback
AI Coach
Conversational financial guidance based on app data
Alerts
Financial alert rule management and triggered alert history
Tax
Tax estimate workflow
Recurring
Recurring transaction and payment visibility
Heatmap
Spending pattern visualization
Trading
Trading-related dashboard views
Settings
User, organization, and application settings

5.3 Frontend Component Design
The frontend uses reusable components for dialogs, cards, tables, charts, forms, feedback, and dashboard widgets.
Component Area
Responsibility
Sidebar and layout
Navigation and protected dashboard layout
Account dialogs
Add or manage financial accounts
Transaction dialogs
Add or edit transactions
Budget components
Display limits, usage, and remaining budget
Goal components
Track goal completion and target progress
Net worth chart
Visualize asset and liability trends
Credit components
Show score history, credit factors, and credit accounts
Debt components
Show debt balances and payoff strategy results
Forecast chart
Visualize spending forecasts
Insight components
Trigger, display, and rate generated insights
AI Coach interface
Accept user questions and display coach responses
Alert manager
Create and manage financial alert rules

6. Backend Architecture
FinVerse has two backend layers:
API routes inside the Next.js web app
A separate worker service for background jobs
6.1 Next.js API Layer
The main browser-facing backend is implemented through API routes under:
apps/web/src/app/api/

The API routes include:
api/
├── accounts/
├── alerts/
├── auth/
├── coach/
├── credit/
├── debt/
├── forecast/spending/
├── goals/
├── heatmap/
├── insights/
├── org/active/
├── recurring/
├── register/
├── tax/estimate/
├── trading/
└── transactions/

Each API route follows the same general flow:
1. Receive request from the frontend.
2. Read request body or query parameters.
3. Validate input.
4. Resolve the authenticated session.
5. Resolve active organization context.
6. Check user role and permissions.
7. Query or update PostgreSQL through Prisma.
8. Return JSON response to the frontend.

6.2 Worker Service
The worker service lives in:
apps/worker/

It uses Fastify and BullMQ. Redis stores the queue state. The worker is useful for jobs that should not block a normal user request.
Possible worker responsibilities include:
Running background financial calculations
Processing scheduled jobs
Handling retryable workflows
Running alert checks
Supporting insight generation workflows
Handling longer-running asynchronous tasks
The worker makes the system more scalable because the web application can stay focused on fast request-response operations while background work is handled separately.
7. Data Model and Persistence
FinVerse uses PostgreSQL as the main database and Prisma as the ORM. The Prisma schema is located in:
packages/db/prisma/schema.prisma

The database is organization-scoped, which means financial data is separated by organization. This supports multi-tenant usage where each organization has its own accounts, transactions, budgets, goals, insights, and financial records.
7.1 Core Data Entities
Entity
Purpose
User
Represents an application user
Account
Stores authentication provider account information
Session
Stores authenticated user session data
VerificationToken
Supports authentication verification flows
Organization
Represents a tenant or workspace
Membership
Connects users to organizations with roles
MfaSecret
Stores encrypted MFA/TOTP information
AuditLog
Tracks important actions and data changes
FinancialAccount
Stores bank, credit, investment, loan, or manual accounts
Transaction
Stores individual financial transactions
Security
Stores investment/security metadata
Holding
Stores investment holdings
Liability
Stores loan or debt liability information
NetWorthSnapshot
Stores net worth values over time
Goal
Stores financial goals
Budget
Stores monthly or period-based budgets
BudgetCategory
Stores category-level budget limits
Insight
Stores generated financial insights
CreditScore
Stores credit score history
CreditAccount
Stores credit account information
CreditHistory
Stores credit-related events
DebtAccount
Stores debt account information
PayoffStrategy
Stores generated debt payoff strategies
PayoffPlan
Stores selected payoff plans
AlertRule
Stores alert conditions created by the user
AlertHistory
Stores triggered alert events
SpendingForecast
Stores forecast output and metadata

7.2 Key Relationships
User
 └── Membership
      └── Organization
           ├── FinancialAccount
           │    ├── Transaction
           │    ├── Holding
           │    └── Liability
           ├── Budget
           │    └── BudgetCategory
           ├── Goal
           ├── Insight
           ├── CreditScore
           ├── CreditAccount
           ├── CreditHistory
           ├── DebtAccount
           │    ├── PayoffStrategy
           │    └── PayoffPlan
           ├── AlertRule
           │    └── AlertHistory
           ├── NetWorthSnapshot
           └── SpendingForecast

A user can belong to multiple organizations. An organization can have multiple members. Most financial records are scoped to an organization and, where needed, also linked to a specific user.
7.3 Money Handling
FinVerse stores monetary values as integer minor units, such as cents, rather than floating-point dollar values. This avoids rounding errors in financial calculations.
For example:
$25.99 is stored as 2599
$1,200.00 is stored as 120000

The application converts values into display-friendly dollar amounts in the frontend or API response layer.
8. Role-Based Access Control
FinVerse uses organization-level roles to control what users can access.
The main roles are:
Role
Responsibility
OWNER
Full organization access and management
ADMIN
Administrative access to most organization operations
MEMBER
Standard access to financial features
VIEWER
Limited or read-only access

Every organization-scoped route should verify:
1. The user is authenticated.
2. The user belongs to the organization.
3. The user has the required role or permission.
4. The request only accesses data from that organization.

This prevents users from accessing financial data outside their organization.
9. Major Application Call Flows
9.1 Authentication Flow
1. User opens the application.
2. User signs in through the authentication page.
3. Auth.js validates the user identity.
4. Session data is created.
5. User is redirected to the protected dashboard.
6. Dashboard layout checks the session.
7. API routes use the session to identify the user.
8. Organization membership is checked before returning financial data.

9.2 Active Organization Flow
1. User signs in.
2. The application resolves the user's active organization.
3. Frontend sends organization-scoped API requests.
4. Backend checks the user's membership in that organization.
5. Backend returns only data belonging to the active organization.
6. Dashboard pages render organization-specific financial information.

9.3 Account Flow
1. User opens the Accounts page.
2. Frontend requests financial accounts for the active organization.
3. Backend validates session and organization membership.
4. Backend loads FinancialAccount records.
5. Frontend displays balances and account information.
6. User creates or edits an account.
7. Backend validates and stores the change.
8. Dashboard updates account and balance views.

9.4 Transaction Flow
1. User opens the Transactions page.
2. Frontend requests transaction records.
3. Backend validates session and organization membership.
4. Backend queries Transaction records by organization and account.
5. Frontend displays transaction list and filters.
6. User adds or edits a transaction.
7. Backend stores transaction data in PostgreSQL.
8. Related charts, budgets, and summaries update based on the new data.

9.5 Budget Flow
1. User opens the Budgets page.
2. Frontend requests budget and category data.
3. Backend loads Budget and BudgetCategory records.
4. Spending totals are calculated from transactions.
5. Frontend compares actual spending against budget limits.
6. User creates or updates a budget.
7. Backend stores the budget limit in minor currency units.
8. Dashboard displays remaining budget and progress.

9.6 Goal Flow
1. User opens the Goals page.
2. Frontend requests financial goals.
3. Backend loads Goal records for the user and organization.
4. Shared goal logic calculates completion percentage.
5. Frontend displays target amount, current amount, and progress.
6. User adds or updates a goal.
7. Backend validates and persists the goal.

9.7 Net Worth Flow
1. User opens the Net Worth page.
2. Backend loads financial accounts, holdings, liabilities, and snapshots.
3. Shared logic calculates total assets and total liabilities.
4. Net worth is calculated as assets minus liabilities.
5. Frontend displays the result using charts and summary cards.
6. Snapshot records can be used to show net worth trends over time.

9.8 Credit Flow
1. User opens the Credit page.
2. Backend loads credit scores, credit accounts, and credit history.
3. Frontend displays score history, account details, and credit factors.
4. Credit factors may include utilization, payment history, credit age, inquiries, and derogatory marks.
5. User can review how credit behavior affects the overall score.

9.9 Debt Payoff Flow
1. User opens the Debt page.
2. Backend loads debt account records.
3. User chooses or generates a payoff strategy.
4. System calculates payoff order, projected payoff date, and interest impact.
5. PayoffStrategy and PayoffPlan records store the result.
6. Frontend displays the strategy and repayment timeline.

9.10 Spending Forecast Flow
1. User opens the Forecast page.
2. Frontend calls the spending forecast API.
3. Backend validates session and organization access.
4. Backend queries historical transaction data.
5. Forecast logic estimates future spending.
6. Forecast output is stored in SpendingForecast.
7. Frontend renders projected spending with chart visualization.

9.11 Insight Flow
1. User opens the Insights page.
2. User triggers insight generation.
3. Backend validates user and organization.
4. Financial data is summarized into structured context.
5. System generates insight text and action items.
6. Insight record is stored with metadata.
7. Frontend displays the insight.
8. User can provide feedback on the insight.

9.12 AI Coach Flow
The AI Coach allows users to ask financial questions in natural language and receive guidance based on their authorized dashboard data.
1. User opens the AI Coach page.
2. User enters a financial question.
3. Frontend sends the question to the coach API route.
4. Backend verifies the user session and active organization.
5. Backend collects relevant financial context such as accounts, transactions, budgets, goals, debt, credit, forecasts, and net worth.
6. The system generates a response based on the available financial context.
7. Frontend displays the coach response to the user.

The AI Coach is designed to explain financial patterns, summarize spending behavior, and suggest practical next steps. It should be treated as an advisory feature and should not replace professional financial, tax, or legal advice.
9.13 Alert Flow
1. User opens the Alerts page.
2. Frontend loads existing alert rules.
3. User creates a financial alert rule.
4. Backend validates and stores the rule.
5. Worker or backend checks whether alert conditions are met.
6. Triggered alerts are stored in AlertHistory.
7. Frontend displays alert status and history.

9.14 Tax Estimate Flow
1. User opens the Tax page.
2. User enters required tax-related inputs.
3. Frontend calls the tax estimate API.
4. Backend validates the request.
5. Backend calculates an estimated tax result.
6. Frontend displays the estimate and related breakdown.

10. AI-Supported Insights and Coach Design
FinVerse includes AI-supported guidance through the Insights and AI Coach modules. The Insights module generates structured observations from financial data, while the AI Coach supports conversational questions from the user.
Both features use organization-scoped financial context. The backend should only pass data that the authenticated user is allowed to access. Instead of exposing unrestricted raw database records, the system should prepare a summarized context that may include spending totals, top categories, budget status, goal progress, debt summary, credit summary, and net worth trends.
The output should be practical, clear, and grounded in available data. For example, the system may explain why spending increased, whether a budget category is close to its limit, or whether a user appears to be on track for a savings goal. Since this feature deals with financial guidance, responses should avoid guarantees and should indicate when data is incomplete.
11. Frontend and Backend Details
11.1 Frontend Details
The frontend is designed around reusable dashboard modules. Each route is responsible for one financial area, while shared components handle repeated UI patterns such as cards, dialogs, charts, and forms.
Frontend responsibilities include:
Rendering dashboard pages
Collecting user input
Calling API routes
Displaying financial charts
Showing loading and error states
Managing local UI state
Rendering AI Coach responses
Displaying insight feedback controls
11.2 Backend Details
The backend API routes are responsible for:
Authentication checks
Organization access checks
Input validation
Database reads and writes
Financial calculations
AI Coach context preparation
Insight persistence
Alert rule management
Forecast generation
JSON response formatting
11.3 Shared Logic Package
The shared package keeps business logic reusable across the web app and worker.
Important shared logic areas include:
packages/shared/src/
├── ai-tools/
├── schemas/
├── budget.ts
├── categorize.ts
├── crypto.ts
├── goal.ts
├── logger.ts
├── money.ts
├── net-worth.ts
├── rbac.ts
└── totp.ts

This keeps calculations consistent. For example, net worth should be calculated the same way whether it appears on the dashboard, in the AI Coach context, or in a background job.
12. Local Development Architecture
The local development setup uses Docker Compose for supporting infrastructure.
docker-compose.yml
├── PostgreSQL
├── Redis
└── Mailhog

Service
Purpose
PostgreSQL
Local relational database
Redis
Queue backend for BullMQ
Mailhog
Local email testing
Web App
Next.js frontend and API
Worker
Background job service
Prisma Studio
Database inspection during development

Typical local development flow:
1. Install dependencies with pnpm.
2. Start infrastructure using Docker Compose or Makefile commands.
3. Run database migrations.
4. Seed development data.
5. Start the web app and worker.
6. Open the dashboard in the browser.

13. Security Architecture
FinVerse handles financial data, so security is a core part of the architecture.
13.1 Authentication
The application uses session-based authentication. Protected dashboard routes require an authenticated user.
13.2 Authorization
Financial data is organization-scoped. A user must be a member of the organization before accessing its accounts, transactions, budgets, goals, insights, AI Coach context, or other financial records.
13.3 Data Isolation
Every API route must filter by organization ID. This prevents one organization from accessing another organization's financial information.
13.4 Audit Logging
Audit logs are used to track important actions. This is useful for accountability, debugging, and security review.
Audit logs can capture:
User ID
Organization ID
Action type
Entity type
Entity ID
Before and after values
IP address
Timestamp
13.5 MFA Support
The data model supports MFA secrets. MFA can improve account protection for users accessing sensitive financial data.
13.6 Secret Management
Production secrets should be stored in Google Secret Manager. Secrets should not be committed to the repository.
Examples of secrets include:
DATABASE_URL
DIRECT_URL
REDIS_URL
AUTH_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
EMAIL_FROM

13.7 AI Feature Security
The AI-supported features should only receive data that the current user is authorized to access. They should use summarized financial context rather than unrestricted raw database access. Responses should avoid exposing unnecessary sensitive details.
14. Google Cloud Platform Deployment
FinVerse can be deployed on Google Cloud Platform using a simple cloud architecture. The Next.js web application is deployed on Cloud Run, the PostgreSQL database is hosted on Cloud SQL, Redis is hosted through Memorystore for BullMQ background jobs, and secrets are stored securely in Secret Manager. Docker images for the web app and worker service are stored in Artifact Registry and can be deployed through Cloud Build.
14.1 Deployment Architecture
User Browser
   |
   v
Cloud Run: finverse-web
Next.js frontend + API routes
   |
   v
Cloud SQL: PostgreSQL

Cloud Run: finverse-worker
Fastify + BullMQ background jobs
   |
   v
Memorystore Redis

Secret Manager
Stores database URLs, auth secrets, Redis URL, SMTP values, and API keys

14.2 Deployment Steps
Create a GCP project and enable Cloud Run, Cloud SQL, Secret Manager, Artifact Registry, Cloud Build, and Memorystore.
Create a PostgreSQL database in Cloud SQL and run Prisma migrations.
Create a Redis instance using Memorystore for the worker queue.
Store production environment variables in Secret Manager, including database, authentication, Redis, and email settings.
Build Docker images for the web app and worker service.
Push the images to Artifact Registry.
Deploy the web app to Cloud Run as finverse-web.
Deploy the worker service to Cloud Run as finverse-worker.
Update the authentication callback URL after Cloud Run generates the production web URL.
Optionally configure Cloud Build for automatic deployment from GitHub.
14.3 GCP Services Used
GCP Service
Purpose
Cloud Run
Hosts the web app and worker service
Cloud SQL
Hosts the PostgreSQL database
Memorystore Redis
Supports BullMQ background queues
Secret Manager
Stores production secrets
Artifact Registry
Stores Docker images
Cloud Build
Automates build and deployment
Cloud Logging
Stores runtime logs

14.4 Production Notes
The web service can scale based on user traffic. The worker service should usually keep at least one instance running if background jobs need to be processed continuously. Secrets should never be stored directly in the codebase, and database migrations should be completed before the production app is used.
15. Reliability and Scalability Considerations
FinVerse separates interactive user requests from background jobs. This improves reliability because long-running jobs do not block the main web application.
Key reliability design points:
Cloud Run scales the web application based on traffic.
Worker service handles background processing separately.
Redis supports queue retries and delayed jobs.
PostgreSQL stores the source of truth.
Secret Manager protects production credentials.
Cloud Logging helps monitor failures.
Database migrations should be run before production traffic uses new schema changes.
16. Conclusion
FinVerse is a multi-tenant financial management platform built with a TypeScript monorepo architecture. The system combines a Next.js dashboard, Prisma/PostgreSQL persistence, shared financial logic, reusable UI components, and a separate worker service for background processing.
The platform supports accounts, transactions, budgets, goals, net worth, credit, debt, forecasts, alerts, tax estimation, insights, AI Coach, trading views, recurring transaction views, and heatmap analysis. The Insights and AI Coach modules add an intelligence layer by helping users interpret their financial data and understand possible next steps.
The application can be deployed on Google Cloud Platform using Cloud Run, Cloud SQL, Memorystore Redis, Secret Manager, Artifact Registry, and Cloud Build.



