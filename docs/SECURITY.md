# Security — Enterprise Financial Dashboard

## 1. Secret Management

### Principles
- No secrets in source code, ever. Gitleaks runs pre-commit and in CI.
- All secrets injected via environment variables. `.env` is gitignored; `.env.example` documents every variable with a description and format.
- Production secrets stored in AWS Secrets Manager. Application reads them at startup via the AWS SDK; secrets are never written to disk.
- Local development uses `.env` + `direnv` (`.envrc` loads the file); developers never share `.env` files.

### Secret Inventory

| Secret | Storage | Rotation | Scope |
|--------|---------|----------|-------|
| `DATABASE_URL` | Env / Secrets Manager | Quarterly | Worker + Web |
| `REDIS_URL` | Env / Secrets Manager | Quarterly | Worker + Web |
| `AUTH_SECRET` | Env / Secrets Manager | On compromise | Web |
| `PLAID_CLIENT_ID` | Env / Secrets Manager | On compromise | Web + Worker |
| `PLAID_SECRET` | Env / Secrets Manager | On compromise | Web + Worker |
| `PLAID_TOKEN_ENCRYPTION_KEY` | Env / Secrets Manager (KMS-wrapped) | Quarterly | Web + Worker |
| `ANTHROPIC_API_KEY` | Env / Secrets Manager | Quarterly | Worker |
| `GOOGLE_CLIENT_ID/SECRET` | Env / Secrets Manager | Annually | Web |
| `SENTRY_DSN` | Env | N/A | Web + Worker |
| `NEXTAUTH_SECRET` | Env / Secrets Manager | On compromise | Web |

---

## 2. Encryption at Rest

### Plaid Access Tokens
Access tokens are the most sensitive asset in the system. They grant direct read access to a user's bank accounts.

**Algorithm:** AES-256-GCM (authenticated encryption — provides both confidentiality and integrity)

**Local pattern:**
```
plaintext  →  AES-256-GCM(key=PLAID_TOKEN_ENCRYPTION_KEY, iv=random 12 bytes)
ciphertext → base64(iv + authTag + ciphertext) stored in PlaidItem.encryptedAccessToken
```

**Production pattern (AWS KMS):**
1. Generate a per-item data key via `kms.generateDataKey(KeyId, AES_256)`.
2. Encrypt the access token with the plaintext data key (AES-256-GCM).
3. Store `base64(encryptedDataKey) + "|" + base64(iv + authTag + ciphertext)` in the DB.
4. To decrypt: call `kms.decrypt(encryptedDataKey)` → retrieve plaintext key → AES-GCM decrypt.
5. KMS key policy grants access only to the ECS task role for the web and worker services.

### MFA Secrets (TOTP seeds)
Stored encrypted using the same AES-256-GCM pattern with a separate `MFA_SECRET_ENCRYPTION_KEY`. Never logged.

### Database-level Encryption
- RDS uses AES-256 encryption at rest (AWS managed keys).
- All connections require TLS (`sslmode=require`); self-signed certs rejected.

### Backups
Database backups (RDS automated + manual snapshots) are encrypted with the same KMS key. Backup access is restricted to the DBA IAM role.

---

## 3. Encryption in Transit

- All external HTTPS traffic: TLS 1.2 minimum, TLS 1.3 preferred. Enforced via CloudFront + ACM.
- Internal service-to-service (web → worker, worker → Postgres/Redis): TLS inside the VPC where supported; VPC security groups limit exposure.
- HTTP Strict Transport Security (HSTS) header: `max-age=31536000; includeSubDomains; preload`.
- Certificate pinning: not implemented (Plaid and Anthropic manage their own certs; pinning introduces fragility with no benefit here).

---

## 4. PII Handling

### Classification
| Data | Class | Handling |
|------|-------|----------|
| Email address | PII | Stored, not logged in plaintext in traces |
| Full name | PII | Stored; redacted in error reports |
| Account numbers (masked) | PII | Plaid returns last 4 only; never full numbers |
| Transaction merchant names | Sensitive | Stored; not passed raw to AI layer |
| Balance amounts | Financial | Stored as BigInt; access-controlled by RLS |
| TOTP seed | Secret | Encrypted at rest; never returned to client after enrollment |

### Data Minimization
- Plaid access tokens: only the minimum product scopes requested (`transactions`, `investments`, `liabilities`).
- Claude API calls: tools return aggregated numbers only. The system prompt instructs the model never to request or repeat raw merchant names or account numbers.
- Sentry: PII scrubbing configured via `beforeSend` hook; `user.email` is hashed before transmission.
- Logs: Pino `redact` option strips `password`, `accessToken`, `encryptedAccessToken`, `secret`, `Authorization` fields from all log output.

### Retention
- Transactions: retained indefinitely (financial history is core value).
- Sessions: expire per `Session.expires`; stale sessions pruned weekly.
- Insights: `expiresAt` set to 90 days; purged by a nightly cleanup job.
- AuditLog: retained 7 years (financial compliance baseline); immutable (no UPDATE/DELETE allowed on table).
- Deleted users: soft-delete with 30-day grace period; hard delete anonymizes PII, retains AuditLog with `userId = null`.

---

## 5. RBAC Matrix

### Roles
| Role | Description |
|------|-------------|
| `OWNER` | Full org control, billing, delete org |
| `ADMIN` | User management, all data, audit log |
| `MEMBER` | Own accounts, own goals/budgets, own insights |
| `VIEWER` | Read-only on shared dashboards (no personal account linking) |

### Permission Matrix

| Permission | OWNER | ADMIN | MEMBER | VIEWER |
|------------|-------|-------|--------|--------|
| `org.delete` | ✅ | ❌ | ❌ | ❌ |
| `org.update` | ✅ | ✅ | ❌ | ❌ |
| `member.invite` | ✅ | ✅ | ❌ | ❌ |
| `member.remove` | ✅ | ✅ | ❌ | ❌ |
| `member.role.update` | ✅ | ✅ | ❌ | ❌ |
| `plaid.link` | ✅ | ✅ | ✅ | ❌ |
| `plaid.unlink` | ✅ | ✅ | own only | ❌ |
| `account.read` | ✅ | ✅ | own only | ✅ (shared) |
| `transaction.read` | ✅ | ✅ | own only | ✅ (shared) |
| `goal.write` | ✅ | ✅ | own only | ❌ |
| `budget.write` | ✅ | ✅ | own only | ❌ |
| `insight.read` | ✅ | ✅ | own only | ❌ |
| `audit.read` | ✅ | ✅ | ❌ | ❌ |
| `settings.mfa` | ✅ | ✅ | own only | own only |

### Implementation
- `requirePermission(permission: Permission)` middleware on every route handler.
- Middleware resolves the caller's `Membership.role` from the verified session and checks against a static permission map.
- Row-Level Security enforces org isolation at the DB level as a second layer — RBAC is defense-in-depth on top.

---

## 6. Audit Logging

Every mutation (INSERT, UPDATE, DELETE on sensitive entities) produces an `AuditLog` record.

### Schema
```
id            UUID       primary key
userId        UUID       who triggered the action
organizationId UUID      which org
action        TEXT       e.g. "plaid_item.created", "goal.updated", "member.removed"
entityType    TEXT       table name
entityId      UUID       PK of the affected row
before        JSONB      snapshot before mutation (PII fields masked)
after         JSONB      snapshot after mutation (PII fields masked)
ipAddress     INET
userAgent     TEXT
createdAt     TIMESTAMPTZ
```

### Constraints
- No UPDATE or DELETE permitted on `audit_log` table (enforced via Postgres policy + revoked privileges for the app DB user).
- `before`/`after` fields redact: `encryptedAccessToken`, `encryptedSecret`, `sessionToken`.
- Writes are synchronous within the same transaction as the mutation — an audit failure rolls back the business operation.

### Alerting
- Admin accesses to `PlaidItem.encryptedAccessToken` table rows trigger an anomaly alert (Postgres `NOTIFY` → worker → Sentry alert).
- Bulk reads (>100 rows in a single session) generate a `HIGH` severity audit event.

---

## 7. Auth Security

### Session Management
- Sessions stored in Postgres (not JWT-in-cookie) — revocable server-side.
- Session token: 32-byte random, stored hashed (SHA-256) in DB; raw token in `HttpOnly; Secure; SameSite=Strict` cookie.
- Session rotation: new token issued on every MFA step-up and privilege elevation.
- Idle timeout: 8 hours. Absolute timeout: 7 days.

### MFA (TOTP)
- TOTP seed generated server-side (32-byte random → base32).
- Seed encrypted with `MFA_SECRET_ENCRYPTION_KEY` before storage.
- QR code generated server-side and streamed as data URI; seed never sent as plaintext to client.
- Recovery codes: 10 × 8-char alphanumeric, hashed with bcrypt, shown once.
- MFA required for: `OWNER` and `ADMIN` roles within 24 hours of first login.

### Password / Magic Link
- No password-based auth. Magic links sent to verified email only.
- Magic link tokens: 32-byte random, expire in 15 minutes, single-use (deleted on consumption).
- Email sending rate-limited: max 5 magic links per email per hour.

### OAuth (Google)
- State parameter validated to prevent CSRF on OAuth callback.
- `id_token` verified with Google public keys (JWKS endpoint, cached 1 hour).
- Account linking: an existing email account is linked to Google on first OAuth sign-in; linkage requires active session (prevents account takeover via email guessing).

---

## 8. Input Validation & Output Encoding

- All API route inputs validated with Zod schemas at the boundary (before any business logic).
- Prisma parameterized queries prevent SQL injection by default; no `$queryRawUnsafe`.
- HTML output from Next.js is auto-escaped; no `dangerouslySetInnerHTML` except in explicitly audited locations.
- API responses serialized through Zod `output` schemas that whitelist fields — prevents accidental secret leakage via new model fields.

---

## 9. Security Headers

Configured via `next-safe` middleware applied to all responses:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

CSP nonces are generated per-request via Next.js middleware and injected into inline scripts.

---

## 10. Third-Party Dependencies

- `npm audit` runs on every CI build; HIGH/CRITICAL advisories block merge.
- Semgrep with the `p/javascript`, `p/typescript`, `p/owasp-top-ten` rule sets runs on every PR.
- Gitleaks scans every commit for secrets (pre-commit hook + CI).
- Dependabot configured for weekly dependency updates (security patches auto-merged if CI is green).
- No dependency is added without a review of its license and transitive dependency count.
