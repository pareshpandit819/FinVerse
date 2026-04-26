# Operations Runbook — Enterprise Financial Dashboard

## On-Call Quick Reference

| Service | URL | Check |
|---------|-----|-------|
| Web app | http://localhost:3000 (dev) / your domain (prod) | `GET /api/health` |
| Worker | http://localhost:3001 (dev) | `GET /health` |
| Postgres | port 5432 | `pg_isready -h localhost` |
| Redis | port 6379 | `redis-cli ping` |
| Mailhog | http://localhost:8025 | dev only |

---

## Starting / Stopping Services

```bash
# Start everything (dev)
make dev

# Stop Docker services
docker compose down

# Restart a single service
docker compose restart postgres
docker compose restart redis
```

---

## Database

### Run migrations
```bash
make db-migrate
# or directly:
pnpm --filter @repo/db exec prisma migrate deploy
```

### Open Prisma Studio (GUI)
```bash
make db-studio
```

### Manual backup (production)
```bash
pg_dump "$DATABASE_URL" --format=custom --no-acl --no-owner \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"
```

### Restore from backup
```bash
# DANGER: drops and recreates the target database
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$DATABASE_URL" backup-YYYYMMDD-HHMMSS.dump
```

### RLS bypass (emergency read, break-glass)
```sql
-- Connect as superuser, then:
SET row_security = off;
SELECT * FROM transactions WHERE organization_id = '<uuid>';
SET row_security = on;
```

---

## Encryption Key Rotation

**When to rotate:** Quarterly, or immediately after a suspected key compromise.

1. Generate a new key:
   ```bash
   openssl rand -hex 32
   ```
2. Add the new key to secrets (AWS Secrets Manager or `.env`) as `PLAID_TOKEN_ENCRYPTION_KEY_NEW`.
3. Run the re-encryption migration:
   ```bash
   # Re-encrypts all PlaidItem.encryptedAccessToken with the new key
   pnpm --filter @repo/worker tsx scripts/reencrypt-tokens.ts \
     --old-key "$PLAID_TOKEN_ENCRYPTION_KEY" \
     --new-key "$PLAID_TOKEN_ENCRYPTION_KEY_NEW"
   ```
4. Swap the keys: rename `_NEW` → active, remove the old key from secrets.
5. Redeploy all workers.

---

## Worker Queue Management

### Check queue depths (via BullMQ)
```bash
redis-cli llen "bull:plaid.sync:wait"
redis-cli llen "bull:net-worth.snapshot:wait"
```

### Drain a stuck queue
```bash
# Remove all waiting jobs in plaid.sync
pnpm --filter @repo/worker tsx scripts/drain-queue.ts plaid.sync
```

### Retry all failed jobs
```bash
pnpm --filter @repo/worker tsx scripts/retry-failed.ts plaid.sync
```

---

## Incident Response

### Authentication failures spike
1. Check `audit_logs` for `action = 'auth.fail'` patterns.
2. Check rate-limit keys in Redis: `redis-cli keys "ratelimit:ip:*"`.
3. If a specific IP is flooding, add it to your WAF or upstream block list.

### Plaid sync failures
1. Check worker logs: `docker compose logs worker --since 1h`.
2. Look for `PlaidItem` records with `status = 'login_required'` — these need user re-auth.
3. If rate-limited by Plaid, jobs will retry with exponential backoff (configured in BullMQ).
4. Check Plaid status page: https://status.plaid.com

### Database connection exhaustion
1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Check for long-running transactions: `SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;`
3. Kill blocking query: `SELECT pg_terminate_backend(<pid>);`

### High memory on worker
1. Check for queue pile-up: BullMQ keeps failed jobs in Redis.
2. Run: `pnpm --filter @repo/worker tsx scripts/drain-queue.ts --failed-only`
3. Restart worker: `docker compose restart worker`

---

## Secrets Reference

| Variable | Where | Rotation |
|----------|-------|----------|
| `PLAID_TOKEN_ENCRYPTION_KEY` | AWS Secrets Manager / `.env` | Quarterly |
| `MFA_SECRET_ENCRYPTION_KEY` | AWS Secrets Manager / `.env` | Quarterly |
| `AUTH_SECRET` | AWS Secrets Manager / `.env` | Annually |
| `PLAID_SECRET` | Plaid dashboard | Per Plaid policy |
| `ANTHROPIC_API_KEY` | Anthropic console | On compromise |
| `DATABASE_URL` | AWS Secrets Manager | On compromise |

---

## Audit Log Queries

```sql
-- Recent privileged actions (last 24h)
SELECT u.email, a.action, a.entity_type, a.entity_id, a.ip_address, a.created_at
FROM audit_logs a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.created_at > now() - interval '24 hours'
  AND a.action NOT IN ('transaction.read', 'account.read')
ORDER BY a.created_at DESC
LIMIT 100;

-- Bulk reads (potential data exfiltration signal)
SELECT user_id, count(*) AS reads, date_trunc('hour', created_at) AS hour
FROM audit_logs
WHERE action LIKE '%.read%'
  AND created_at > now() - interval '24 hours'
GROUP BY user_id, hour
HAVING count(*) > 500
ORDER BY reads DESC;
```

---

## Plaid Production Checklist

Before requesting Plaid production access:

- [ ] Privacy policy published at `/privacy`
- [ ] Terms of service published at `/terms`
- [ ] Data use disclosure in onboarding flow
- [ ] Webhook endpoint is publicly reachable and verified
- [ ] `PLAID_ENV=production` and production secret in Secrets Manager
- [ ] Consent expiry handling (re-link flow when `consent_expires_at` is past)
- [ ] Read `docs/PLAID_PRODUCTION.md` end-to-end

---

## Performance Baselines (v0.1 targets)

| Metric | Target | Tool |
|--------|--------|------|
| Dashboard TTFB | < 200ms | Lighthouse |
| Dashboard LCP | < 2.5s | Lighthouse |
| Plaid sync (1000 txns) | < 10s | Worker logs |
| Net worth snapshot | < 500ms | Worker logs |
| API p99 latency | < 300ms | OTEL / Grafana |
