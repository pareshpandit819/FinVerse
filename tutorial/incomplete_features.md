# Incomplete & Missing Features

This document lists features that are either partially implemented, missing UI, or entirely absent from the current v0.1.0 build.

---

## Critical — Breaks Core Functionality

### 1. Plaid Integration Is UI-Only Stubs
**Status:** Backend scaffolded, frontend button exists, but no real Plaid credentials configured  
**What's missing:**
- `PLAID_CLIENT_ID` and `PLAID_SECRET` not set in `.env`
- `PLAID_WEBHOOK_URL` points to localhost — Plaid can't reach it without ngrok
- The "Connect Account" button in the UI will error without real Plaid credentials
- **Fix:** Get Plaid sandbox credentials from dashboard.plaid.com, set in `.env`, run `ngrok http 3001`

### 2. AI Insights Require Anthropic API Key
**Status:** Worker and UI fully built, but key not configured  
**What's missing:**
- `ANTHROPIC_API_KEY=` is empty in `.env`
- Clicking "Generate Insight" queues a job that immediately fails with an auth error
- **Fix:** Get key from console.anthropic.com and add to `.env`

---

## High — Missing User-Facing Features

### 3. No Goal Editing or Deletion
**Status:** Goals can be created and viewed, but not updated or removed  
**What's missing:**
- No `PATCH /api/goals/[id]` route
- No `DELETE /api/goals/[id]` route
- No edit button on goal cards
- No delete button on goal cards

### 4. No Transaction Editing or Deletion
**Status:** Transactions display correctly but are read-only after creation  
**What's missing:**
- `PATCH /api/transactions/[id]` exists in the backend but no UI exposes it
- No delete button on transaction rows
- No way to recategorize a transaction from the UI (only via `customCategory` field which has no UI)

### 5. No Budget Creation UI
**Status:** Budgets display correctly if they exist in the DB, but cannot be created from the UI  
**What's missing:**
- No `POST /api/budgets` route
- No "Create Budget" button or dialog
- Budget categories cannot be added, edited, or removed from the UI
- The current month's budget only shows if seeded or created via Prisma Studio

### 6. No Settings Page Implementation
**Status:** `/settings` route exists in the sidebar but renders a blank page  
**What's missing:**
- Profile editing (name, avatar)
- Password change form
- Email notification preferences
- Organization name editing (OWNER only)
- MFA management (view status, re-enroll, disable)
- Danger zone: delete account

### 7. Dashboard Overview Page Is Static
**Status:** The `/dashboard` page shows hardcoded placeholder cards  
**What's missing:**
- Net worth summary card should pull from `NetWorthSnapshot`
- Recent transactions list (last 5 transactions across all accounts)
- Budget progress summary
- Goal progress widgets
- Quick action buttons

### 8. No Account Balance Editing
**Status:** Accounts can be created and deleted, but balances cannot be updated from the UI  
**What's missing:**
- No edit button on account cards
- The `PATCH /api/accounts/[id]` route exists but is not exposed in the UI

---

## Medium — Missing Functionality

### 9. No MFA Enrollment Flow Wired to Auth
**Status:** MFA enrollment pages exist at `/mfa/enroll` and `/mfa/challenge` but the post-login redirect to MFA challenge is not enforced  
**What's missing:**
- After login, OWNER/ADMIN users should be redirected to `/mfa/challenge` if `mfa_verified_at` is older than 24 hours
- The middleware check exists but the redirect flow to the challenge page is incomplete

### 10. No Goal–Account Linking UI
**Status:** The `Goal` model has a `linkedAccountIds` field and the API accepts it, but the UI never shows or sets it  
**What's missing:**
- Multi-select of financial accounts when creating or editing a goal
- The goal's `currentAmount` is never auto-updated from linked account balances

### 11. Insights Feedback Not Persisted Correctly
**Status:** The `InsightFeedback` component sends a request but the route handler needs verification  
**What's missing:**
- `POST /api/insights/[id]/feedback` sets `helpful` on the insight record
- The thumbs up/down buttons do not optimistically update state (page refresh required to see change)
- No aggregate feedback display (e.g., "3 users found this helpful")

### 12. No Search or Filtering on Transactions
**Status:** Transactions page lists all transactions with no filtering  
**What's missing:**
- Date range filter
- Category filter
- Account filter
- Amount range filter
- Search by merchant name

### 13. Net Worth Chart Only Renders With Seed Data
**Status:** The net worth line chart fetches from `NetWorthSnapshot` but the worker that populates it requires a running BullMQ job  
**What's missing:**
- Worker's cron job runs daily at 2 AM — no data until the first job fires
- No "Calculate Now" button to trigger a manual snapshot
- The chart shows "No data" for new users who haven't connected Plaid

### 14. Email Magic Link Not Tested End-to-End
**Status:** Mailhog captures emails locally, but the magic link flow requires clicking the link in Mailhog  
**What's missing:**
- No documentation on the magic link sign-in flow for demo users
- Magic link tokens expire — need to be used within ~10 minutes

---

## Low — Polish & UX

### 15. No Loading States on Server-Rendered Pages
**Status:** Dashboard pages do not show skeleton loaders while data loads  
**What's missing:**
- `loading.tsx` files for each route segment
- Suspense boundaries around data-fetching components

### 16. No Error Boundaries
**Status:** If an API call fails inside a React Server Component, the entire page crashes  
**What's missing:**
- `error.tsx` files for each route segment
- Graceful error messages instead of full page crashes

### 17. No Pagination on Transactions
**Status:** `GET /api/transactions` returns all transactions (no pagination implemented in the UI)  
**What's missing:**
- Page/offset or cursor-based pagination controls
- "Load more" button or infinite scroll

### 18. No Responsive Mobile Layout
**Status:** Sidebar and dashboard are designed for desktop (1024px+)  
**What's missing:**
- Mobile hamburger menu to toggle sidebar
- Responsive grid adjustments for account/goal cards
- Bottom navigation bar for mobile

### 19. Credit Score Components Use Hardcoded Data
**Status:** Credit factors chart renders with static demo values rather than from `CreditScore` model  
**What's missing:**
- Wire `paymentHistory`, `creditUtilization`, `creditAge`, `derogatoryMarks`, `hardInquiries` from the latest `CreditScore` record
- Credit accounts page may not reflect the `CreditAccount` model correctly

### 20. No Notification System
**Status:** Budget breach, goal completion, and anomalous transactions are detected by workers but never surfaced to the user  
**What's missing:**
- In-app notification bell
- Email notification triggers
- WebSocket/SSE for real-time alerts

---

## Production Blockers (Out of Scope for Dev, Required Before Launch)

| # | Item |
|---|------|
| 21 | Plaid production access requires Plaid review (1–4 weeks) |
| 22 | Google OAuth credentials need to be set up in Google Cloud Console |
| 23 | AWS infrastructure (ECS, RDS, ElastiCache) not provisioned |
| 24 | Sentry DSN not configured — errors are not tracked |
| 25 | No CI environment secrets configured in GitHub |
| 26 | E2E tests (Playwright) require `playwright install` and a running dev server |
| 27 | `make security` requires Semgrep and Gitleaks installed locally |
| 28 | SSL/TLS certificate and custom domain not configured |

---

## Quick-Win Priority Order

If you want to make the most impact before a demo, address these first:

1. **Add `ANTHROPIC_API_KEY`** → unlocks all AI insights immediately
2. **Add Plaid credentials + ngrok** → unlocks real bank account connections
3. **Implement the Dashboard overview page** → makes the landing page actually useful
4. **Add transaction filtering** → makes the Transactions page usable
5. **Add Budget creation UI** → closes the largest feature gap for new users
6. **Add Goal editing/deletion** → completes the Goals CRUD loop
7. **Wire Settings page** → lets users change their password without direct DB access
