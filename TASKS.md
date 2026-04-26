# Manual Tasks

Everything in this file requires a human. Tasks are grouped by phase and marked with their status and urgency.

Legend: `[ ]` = not started · `[x]` = done · `[~]` = optional / can defer

---

## Prerequisites (before any phase)

- [ ] **Install Node.js ≥ 20**
  ```bash
  # via nvm (recommended)
  nvm install 20 && nvm use 20
  # or via Homebrew
  brew install node@20
  ```

- [ ] **Install pnpm ≥ 9**
  ```bash
  npm install -g pnpm@9
  ```

- [ ] **Install Docker Desktop** (≥ 24)
  https://www.docker.com/get-started/

- [ ] **Install make** (pre-installed on macOS/Linux; Windows: use WSL2 or Git Bash)

---

## Phase 1 — Repo Scaffold & DevEx

- [ ] **Run first-time setup**
  ```bash
  make setup
  ```
  This installs dependencies, starts Docker services, runs migrations, and seeds the database.

- [ ] **Copy `.env.example` → `.env`** (done automatically by `make setup`, but verify values)
  ```bash
  cp .env.example .env
  ```

- [ ] **Generate `AUTH_SECRET`** (required for Auth.js session signing)
  ```bash
  openssl rand -base64 32
  # Paste result into .env → AUTH_SECRET and NEXTAUTH_SECRET
  ```

- [ ] **Generate `PLAID_TOKEN_ENCRYPTION_KEY`** (32-byte AES key for Plaid token storage)
  ```bash
  openssl rand -hex 32
  # Paste into .env → PLAID_TOKEN_ENCRYPTION_KEY
  ```

- [ ] **Generate `MFA_SECRET_ENCRYPTION_KEY`** (32-byte AES key for TOTP secret storage)
  ```bash
  openssl rand -hex 32
  # Paste into .env → MFA_SECRET_ENCRYPTION_KEY
  ```

- [ ] **Verify Docker services are healthy**
  ```bash
  docker compose ps
  # All three services (postgres, redis, mailhog) should show "healthy"
  ```

---

## Phase 2 — Database, Auth & Multi-Tenancy

- [ ] **Obtain Google OAuth credentials** (for Google sign-in)
  1. Go to https://console.cloud.google.com/apis/credentials
  2. Create a new OAuth 2.0 Client ID (Web application)
  3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
  4. Copy Client ID → `.env` `GOOGLE_CLIENT_ID`
  5. Copy Client Secret → `.env` `GOOGLE_CLIENT_SECRET`

- [ ] **Run database migrations**
  ```bash
  make db-migrate
  ```

- [ ] **Seed development data**
  ```bash
  make db-seed
  # Creates: Acme Financial org, 4 users (owner/admin/member/viewer), fake Plaid data
  ```

- [ ] **Verify Mailhog is receiving magic-link emails**
  1. Start the app: `make dev`
  2. Go to http://localhost:3000/login
  3. Enter `owner@acme.example` and click "Send sign-in link"
  4. Check http://localhost:8025 — the magic link email should appear

- [ ] **Test MFA enrollment**
  1. Sign in as `owner@acme.example` (via magic link)
  2. Go to http://localhost:3000/mfa/enroll
  3. Scan the QR code with Google Authenticator or Authy
  4. Enter the 6-digit code to confirm enrollment

---

## Phase 3 — Plaid Integration

- [ ] **Create a Plaid developer account**
  https://dashboard.plaid.com/signup
  - Free sandbox tier is sufficient for development

- [ ] **Obtain Plaid API credentials**
  1. Log in to https://dashboard.plaid.com/developers/keys
  2. Copy `client_id` → `.env` `PLAID_CLIENT_ID`
  3. Copy `Sandbox` secret → `.env` `PLAID_SECRET`
  4. Confirm `.env` has `PLAID_ENV=sandbox`

- [ ] **Set up a webhook tunnel for local development**
  Plaid webhooks require a publicly reachable URL. Use ngrok or a similar tool:
  ```bash
  # Install ngrok: https://ngrok.com/download
  ngrok http 3001
  # Copy the https URL (e.g. https://abc123.ngrok.io)
  # Set in .env: PLAID_WEBHOOK_URL=https://abc123.ngrok.io/webhooks/plaid
  ```
  > Note: ngrok URL changes on each restart unless you have a paid plan. Update `.env` each session.

- [ ] **Run a manual Plaid sandbox smoke test** (after Phase 3 code is done)
  1. Start `make dev`
  2. Sign in and click "Connect Account" (once the UI is wired — Phase 6)
  3. Use Plaid Link sandbox credentials:
     - Username: `user_good`
     - Password: `pass_good`
  4. Verify accounts appear and a sync job is queued

- [ ] **Review `docs/PLAID_PRODUCTION.md`** before requesting Plaid development/production access
  (written in Phase 9 — do this before going live)

---

## Phase 5 — AI Insights Layer

- [ ] **Obtain an Anthropic API key**
  1. Go to https://console.anthropic.com/
  2. Create an API key
  3. Paste into `.env` → `ANTHROPIC_API_KEY`

- [ ] **Set per-user token budget**
  Default is 100,000 tokens/day (`AI_DAILY_TOKEN_BUDGET` in `.env`).
  Adjust based on expected usage and cost tolerance.

- [ ] **Review AI guardrails** in `apps/worker/src/workers/insight-worker.ts` (Phase 5)
  Confirm the system prompt and refusal patterns match your compliance requirements.

---

## Phase 6 — Frontend

- [ ] **Install Playwright browsers** (required for E2E tests)
  ```bash
  pnpm --filter @repo/web exec playwright install --with-deps chromium
  ```

- [ ] **Run E2E tests manually** after Phase 6 is complete
  ```bash
  make test-e2e
  ```

- [ ] **Check Lighthouse scores**
  1. Open Chrome DevTools → Lighthouse
  2. Run on http://localhost:3000/dashboard
  3. Target: ≥ 90 on Performance, Accessibility, Best Practices

---

## Phase 7 — Hardening

- [ ] **Install Semgrep CLI** (for `make security`)
  ```bash
  # macOS
  brew install semgrep
  # or via pip
  pip3 install semgrep
  ```

- [ ] **Install Gitleaks** (for secret scanning)
  ```bash
  brew install gitleaks
  # or download from https://github.com/gitleaks/gitleaks/releases
  ```

- [~] **Set up Semgrep Cloud account** (optional — enables dashboard and PR comments)
  https://semgrep.dev/login
  Add `SEMGREP_APP_TOKEN` to GitHub repository secrets.

- [~] **Set up Gitleaks license** (optional — enables cloud reporting)
  Add `GITLEAKS_LICENSE` to GitHub repository secrets.

- [ ] **Run `make security`** and confirm all checks pass
  ```bash
  make security
  ```

---

## Phase 8 — Testing & Final QA

- [ ] **Install Stryker** (mutation testing) globally or as a dev dependency
  ```bash
  pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner --filter @repo/shared
  ```

- [ ] **Run full test suite and review coverage report**
  ```bash
  make test-coverage
  # Open coverage/index.html in a browser
  ```

- [ ] **Complete `docs/QA_CHECKLIST.md`** (written in Phase 8)
  Walk through each item manually and attach screenshots/recordings.

---

## Phase 9 — Handoff & Production

### GitHub Repository Setup

- [ ] **Create a GitHub repository** and push the code
  ```bash
  git init
  git remote add origin https://github.com/YOUR_ORG/enterprise-financial-dashboard.git
  git push -u origin main
  ```

- [ ] **Configure GitHub repository secrets** (required for CI)
  Go to Settings → Secrets and variables → Actions, and add:
  | Secret | Value |
  |--------|-------|
  | `TEST_PLAID_TOKEN_ENCRYPTION_KEY` | 64-char hex string |
  | `TEST_MFA_SECRET_ENCRYPTION_KEY` | 64-char hex string |
  | `SEMGREP_APP_TOKEN` | From Semgrep dashboard (optional) |
  | `GITLEAKS_LICENSE` | From Gitleaks (optional) |

- [ ] **Enable Dependabot** in GitHub repository settings
  Settings → Security → Dependabot alerts → Enable

### AWS Setup (production)

- [ ] **Create an AWS account** (if not already)
  https://aws.amazon.com/

- [ ] **Install AWS CLI and Terraform**
  ```bash
  brew install awscli terraform
  aws configure  # Set access key, secret, region
  ```

- [ ] **Create production secrets in AWS Secrets Manager**
  For each secret in `.env.example`, create a corresponding entry in Secrets Manager:
  ```bash
  aws secretsmanager create-secret \
    --name /efd/production/ANTHROPIC_API_KEY \
    --secret-string "sk-ant-..."
  # Repeat for all secrets
  ```

- [ ] **Create a KMS key** for Plaid token envelope encryption
  ```bash
  aws kms create-key --description "EFD Plaid token encryption key"
  # Note the key ARN; add to Terraform and app config
  ```

- [ ] **Review and apply Terraform infrastructure** (from `infra/` — written in Phase 9)
  ```bash
  cd infra
  terraform init
  terraform plan   # Review carefully before applying
  terraform apply
  ```

- [ ] **Configure a custom domain** and SSL certificate (ACM)
  1. Register or transfer domain via Route 53
  2. Request ACM certificate (DNS validation)
  3. Point CloudFront distribution to the certificate

### Plaid Production Access

- [ ] **Complete Plaid's production review process**
  1. Read `docs/PLAID_PRODUCTION.md` (Phase 9)
  2. Move to Plaid Development tier: https://dashboard.plaid.com/overview/development
  3. Submit your app for Plaid Production review when ready
  4. Plaid requires: privacy policy, terms of service, data use disclosure, security review
  5. Timeline: typically 1–4 weeks for approval

- [ ] **Update `.env` / Secrets Manager** after Plaid approves production access:
  - `PLAID_ENV=production`
  - `PLAID_SECRET=<production secret from Plaid dashboard>`

### Operational Readiness

- [ ] **Configure Sentry project** and add DSN
  1. Create project at https://sentry.io
  2. Add `SENTRY_DSN` to production secrets

- [~] **Set up an OpenTelemetry collector** (optional for v0.1)
  e.g., AWS Distro for OpenTelemetry, Grafana Cloud, or Honeycomb

- [ ] **Review `docs/RUNBOOK.md`** (Phase 7) — ensure backup/restore and incident response procedures are understood by the team

- [ ] **Run a production backup drill** before going live
  Follow the restore procedure in `docs/RUNBOOK.md` end-to-end in staging

---

## Ongoing Maintenance

- [~] **Rotate encryption keys quarterly**
  ```bash
  # Generate new key
  openssl rand -hex 32
  # Run re-encryption migration script (docs/RUNBOOK.md)
  # Update AWS Secrets Manager
  # Redeploy workers
  ```

- [~] **Review Dependabot PRs weekly**
  Auto-merge if CI passes; manually review major version bumps

- [~] **Check Semgrep scan results** after each significant PR
  Review findings at https://semgrep.dev/

- [~] **Audit `audit_logs` table** for anomalies monthly
  Look for: bulk reads, off-hours admin access, repeated permission denials

---

## Quick Reference — Key URLs

| Service | Development URL |
|---------|----------------|
| Web app | http://localhost:3000 |
| Worker health | http://localhost:3001/health |
| Mailhog (email) | http://localhost:8025 |
| Prisma Studio | `make db-studio` |
| Plaid dashboard | https://dashboard.plaid.com |
| Anthropic console | https://console.anthropic.com |
| Google Cloud console | https://console.cloud.google.com |
