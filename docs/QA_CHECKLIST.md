# QA Checklist — v0.1.0

Mark each item as `[x]` and attach screenshots/recordings when noted.

---

## Authentication

- [ ] Magic link email arrives in Mailhog (dev) within 30 seconds
- [ ] Magic link logs the user in and redirects to `/dashboard`
- [ ] Google OAuth sign-in works end-to-end
- [ ] MFA enrollment: QR code renders, TOTP code validates, session stamped
- [ ] MFA challenge: after enroll, subsequent logins prompt for TOTP
- [ ] Session expires after 7 days (check cookie `Max-Age`)
- [ ] Unauthenticated request to `/dashboard` redirects to `/login`
- [ ] `callbackUrl` param is preserved through login redirect

## Multi-Tenancy & RBAC

- [ ] VIEWER role cannot see "Connect Account" button
- [ ] MEMBER cannot access Settings > Team Members section
- [ ] OWNER can invite members (route exists, responds correctly)
- [ ] Org isolation: seeded org data not visible to a second test org

## Plaid Integration

- [ ] Plaid Link modal opens when clicking "Connect Account"
- [ ] Sandbox credentials (`user_good` / `pass_good`) complete the flow
- [ ] Accounts appear on Accounts page after sync
- [ ] Transaction sync populates Recent Transactions on Dashboard
- [ ] Relink flow triggered for a simulated `login_required` item
- [ ] Webhook endpoint returns 401 for requests without valid JWT header

## Net Worth & Charts

- [ ] Net worth snapshot created after first sync
- [ ] Chart renders on `/net-worth` with at least one data point
- [ ] Dashboard KPI cards show correct values matching DB
- [ ] Negative net worth renders correctly (red, minus sign)

## Goals

- [ ] Goal progress bar updates after net-worth snapshot
- [ ] Completed goal shows "Done" badge
- [ ] At-risk goal shows "At risk" badge when contribution rate is low

## Budgets

- [ ] Budget summary card shows correct % utilization
- [ ] Over-budget category renders red progress bar
- [ ] Rollover calculation applies correctly (if enabled)

## AI Insights

- [ ] "Generate Insight" button queues a job (returns 202)
- [ ] Insight appears on page after worker processes it
- [ ] Thumbs up/down feedback persists on page reload
- [ ] No PII (account numbers, full names) appears in insight body

## Security Headers

Check via browser DevTools > Network > Response Headers on any page:

- [ ] `Content-Security-Policy` header present
- [ ] `Strict-Transport-Security` header present (production only)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] No `Server` header leaking version info

## Rate Limiting

- [ ] > 60 rapid API requests from same IP returns 429
- [ ] `Retry-After` header present on 429 response

## Performance (Lighthouse — http://localhost:3000/dashboard)

| Metric | Target | Actual |
|--------|--------|--------|
| Performance | ≥ 90 | |
| Accessibility | ≥ 90 | |
| Best Practices | ≥ 90 | |
| LCP | < 2.5s | |
| TTFB | < 200ms | |

## Mobile Responsiveness

- [ ] Dashboard readable on 375px viewport (iPhone SE)
- [ ] Sidebar collapses / is hidden on mobile
- [ ] All touch targets ≥ 44px

---

*Completed by:* _______________  
*Date:* _______________  
*Build version:* _______________
