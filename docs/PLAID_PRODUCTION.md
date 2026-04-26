# Plaid Production Readiness Guide

## Overview

This document covers everything required before requesting Plaid Production access. Plaid requires a manual review process (typically 1–4 weeks). Start this process early.

---

## Access Tiers

| Tier | Purpose | Limit |
|------|---------|-------|
| Sandbox | Development, automated testing | Unlimited |
| Development | QA with real user data (invite-only) | 100 items |
| Production | Live users | Unlimited (fee per item) |

Request Development access first: https://dashboard.plaid.com/overview/development

---

## Pre-Review Checklist

### Legal & Compliance

- [ ] **Privacy policy** published at a public URL
  - Must explain: what data you collect, how it's used, how it's stored, and how users can request deletion
  - Link to Plaid's End User Privacy Policy: https://plaid.com/legal/#end-user-privacy-policy
- [ ] **Terms of Service** published at a public URL
- [ ] **Data use disclosure** in your app's onboarding flow
  - Users must understand you're connecting to Plaid and what data will be retrieved
- [ ] **Data deletion flow** — users must be able to disconnect their accounts and have data deleted

### Security

- [ ] HTTPS enforced everywhere (no mixed content)
- [ ] `PLAID_TOKEN_ENCRYPTION_KEY` is a 256-bit random key stored in AWS Secrets Manager
- [ ] Plaid access tokens are never logged or included in error messages
- [ ] Webhook endpoint is verified (JWT signature check implemented — see `webhook-verifier.ts`)
- [ ] Re-link flow implemented for `ITEM_LOGIN_REQUIRED` status (`/api/plaid/relink`)
- [ ] Consent expiry handled: check `plaidItem.consentExpiresAt` and prompt re-auth

### Product Requirements

- [ ] Plaid Link is the only way to connect accounts (no workarounds)
- [ ] "Disconnect account" functionality removes the Plaid item and deletes tokens
- [ ] App displays institution name and account mask to users
- [ ] Error states handled gracefully (expired tokens, login required, etc.)

---

## Environment Switch

When Plaid approves production access:

```bash
# Update .env / AWS Secrets Manager:
PLAID_ENV=production
PLAID_SECRET=<production-secret-from-plaid-dashboard>

# Redeploy web and worker
```

Update `apps/web/src/lib/plaid.ts` and `apps/worker/src/lib/plaid.ts` — both read `PLAID_ENV` from the environment, so no code change is needed.

---

## Webhook Production Setup

1. Set `PLAID_WEBHOOK_URL` to your production HTTPS URL:
   ```
   PLAID_WEBHOOK_URL=https://your-domain.com/webhooks/plaid
   ```
2. Verify the webhook URL is reachable from Plaid's IPs.
3. Plaid sends a `WEBHOOK_UPDATE_ACKNOWLEDGED` event — confirm it appears in your logs.

---

## Consent Expiry Handling

Plaid items have a `consent_expires_at` field (typically 12 months for new integrations). Your app must:

1. Store `consentExpiresAt` on the `PlaidItem` (already done in schema).
2. 30 days before expiry, surface a banner in the UI prompting re-authorization.
3. Use the relink flow (`/api/plaid/relink`) to refresh consent.

Add a daily cron job that checks for items expiring within 30 days and creates an in-app notification (Phase 9+ enhancement).

---

## Plaid Products Requested

The app uses the following Plaid products (declared in link token creation):

| Product | Purpose | Required |
|---------|---------|---------|
| `transactions` | Transaction sync via `/transactions/sync` | Yes |
| `investments` | Holdings and securities | Optional |
| `liabilities` | Credit, student, mortgage | Optional |

Configure the products in `.env`:
```bash
PLAID_PRODUCTS=transactions,investments,liabilities
```

---

## Cost Estimate

Plaid charges per item per month. Estimate:

| Tier | Cost per item/month |
|------|---------------------|
| Transactions | ~$0.30 |
| Investments | ~$0.30 |
| Liabilities | ~$0.20 |

100 users × 2 items avg × $0.80 = ~$160/month at 100 users.
Review the official pricing at https://plaid.com/pricing/ before launch.
