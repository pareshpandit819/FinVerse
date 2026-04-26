# ADR-0004: Auth.js v5 with Prisma adapter over custom session management

## Status
Accepted

## Context
The application requires: email magic links, Google OAuth, TOTP-based MFA, server-side session storage (revocable), and tight integration with Next.js App Router. We need a proven, maintained solution without writing custom session management.

## Decision
Use **Auth.js v5** (formerly NextAuth.js) with the **Prisma adapter** for session persistence. Extend with custom TOTP MFA middleware.

## Rationale
- Auth.js v5 has first-class Next.js App Router support (`auth()` in server components and middleware).
- The Prisma adapter stores sessions, accounts, and users in our existing Postgres database — no separate auth service.
- Magic link (email) and Google OAuth are built-in providers.
- Server-side session storage means sessions are revocable immediately (no JWT invalidation problem).
- Active maintenance, large community, extensive documentation.

## MFA Extension
Auth.js does not include TOTP natively. Extension plan:
1. After successful primary auth, check `MfaSecret.verified` for the user.
2. If MFA is enrolled, redirect to `/auth/mfa-challenge` before issuing the session cookie.
3. TOTP verification calls `packages/shared/src/totp.ts` (wraps `otpauth` library).
4. On success, set a short-lived `mfa_verified` claim in the session and issue the final session token.

## Alternatives Considered
- **Clerk**: Excellent DX, but SaaS with per-MAU pricing and data leaving our infrastructure. Rejected for financial data handling.
- **Lucia**: Minimal, educational-focused. Less battle-tested for production MFA flows.
- **Custom implementation**: Highest control, highest risk. Session management bugs are security bugs. Rejected.
- **Auth0 / Okta**: Enterprise pricing; external data storage; over-engineered for this use case at v0.1.

## Consequences
- Auth.js session/account/user tables are added to the Prisma schema alongside our custom entities.
- MFA challenge is a custom two-step flow layered on top of Auth.js callbacks.
- Session rotation (on MFA step-up) requires calling `auth()` with explicit `update()` to refresh the session token.
