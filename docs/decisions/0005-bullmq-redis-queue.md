# ADR-0005: BullMQ + Redis for job queue over in-process scheduling

## Status
Accepted

## Context
Several operations must not block HTTP request/response cycles and need reliable retry semantics: initial Plaid sync (~seconds to minutes), transaction sync on webhook, daily net worth snapshots, and weekly AI insight generation. These jobs must survive worker restarts and support exponential backoff.

## Decision
Use **BullMQ** with **Redis 7** as the job queue for all background work.

## Rationale
- BullMQ is the modern successor to Bull; built-in TypeScript types, per-job retry strategies, delayed jobs, cron scheduling, and job prioritization.
- Redis persistence (AOF) ensures jobs survive restarts without being lost.
- Bull Board provides a UI for monitoring queue health in development and staging.
- Separating job processing into `apps/worker` keeps the Next.js process lightweight and independently scalable.
- BullMQ's `concurrency` option lets us rate-limit Plaid API calls per worker.

## Queue Design
| Queue | Producer | Consumer | Concurrency | Retry |
|-------|----------|----------|-------------|-------|
| `plaid.sync` | BFF (on exchange/webhook) | `apps/worker` | 5 | 3× exp backoff, cap 1h |
| `plaid.investments` | BFF / cron | `apps/worker` | 3 | 3× exp backoff, cap 1h |
| `net-worth.snapshot` | Sync worker / cron | `apps/worker` | 10 | 2× exp backoff |
| `insights.generate` | Cron / on-demand | `apps/worker` | 2 (LLM rate limits) | 2× exp backoff |

## Alternatives Considered
- **`node-cron` / `setTimeout` in-process**: Not durable; jobs lost on restart; can't distribute across workers.
- **AWS SQS**: Managed, durable, but adds AWS dependency to local development and increases latency.
- **Postgres-backed queue (pg-boss)**: Eliminates Redis dependency. Simpler ops, but higher DB load for high-frequency jobs. Good future option if Redis becomes an ops burden.
- **Temporal**: Excellent for complex workflows, but heavyweight for v0.1. Can migrate later.

## Consequences
- Redis 7 is a required infrastructure dependency (included in `docker-compose.yml`).
- All job payloads must be serializable to JSON (BigInt values serialized as strings with a custom replacer).
- Job payloads validated with Zod on dequeue to catch schema drift between producer and consumer.
