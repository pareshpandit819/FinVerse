# Deferred Items — Enterprise Financial Dashboard v0.1.0

Items explicitly out of scope for the initial release. Each entry includes a reason and a suggested future phase.

---

## Multi-Currency Support
**Deferred to:** v0.2
**Reason:** Requires a daily FX rates table, a rates provider integration (e.g., Open Exchange Rates), and conversion logic in the net worth calculator. The data model is designed for extension (all accounts store `isoCurrencyCode`), but the calculator treats everything as USD for v0.1 to reduce scope.

---

## Mobile Application
**Deferred to:** v1.0
**Reason:** The web app is mobile-responsive (375px+), but a native iOS/Android app is out of scope. The BFF API is designed to be consumed by future mobile clients.

---

## Push Notifications
**Deferred to:** v0.3
**Reason:** Budget breach alerts and goal milestones are in-app only for v0.1. Push requires APNs/FCM integration and a notification preference system.

---

## Investment Performance Analytics
**Deferred to:** v0.3
**Reason:** Holdings sync and current value are implemented. IRR calculation, benchmark comparison (vs. S&P 500), and tax-lot tracking require additional data sources and significant domain complexity.

---

## Bill Pay / Payment Initiation
**Deferred to:** Future (post-Plaid Production approval)
**Reason:** Plaid Payment Initiation requires separate Plaid agreement and compliance review. Read-only data aggregation is the v0.1 scope.

---

## AI Model Fine-Tuning
**Deferred to:** v1.0
**Reason:** The insight generation system is designed with an ML-ready interface for future fine-tuning. Collecting labeled feedback data (helpful/not helpful) in v0.1 to enable this later.

---

## Advanced Tax Reporting
**Deferred to:** v0.3
**Reason:** Capital gains calculations, 1099 report generation, and tax-loss harvesting suggestions require investment transaction history and tax-lot accounting not in v0.1 scope.

---

## White-Label / Custom Branding
**Deferred to:** v1.0
**Reason:** Multi-tenant architecture supports it, but per-org theming, custom domains, and logo management are product features, not infrastructure.

---

## SAML / Enterprise SSO
**Deferred to:** v0.3
**Reason:** Google OAuth covers the MVP. SAML (Okta, Azure AD) is required for enterprise sales but is an Auth.js-supported extension path.

---

## Real-Time Streaming (WebSockets)
**Deferred to:** v0.2
**Reason:** Initial Plaid sync completion is communicated via polling on the frontend. Full WebSocket/SSE infrastructure (with authentication and reconnect logic) is deferred to reduce Phase 1 complexity. The architecture accommodates it.

---

## Terraform Apply / AWS Deployment
**Deferred to:** Post-v0.1 (ops team)
**Reason:** Phase 9 delivers Terraform stubs as illustrative infrastructure-as-code. Actual provisioning and deployment to AWS requires environment-specific secrets, domain registration, and Plaid production approval — all manual gates beyond the scope of this build phase.
