/**
 * Redis sliding-window rate limiter.
 * Uses a sorted set keyed by `ratelimit:<key>` with scores = timestamp.
 * Returns whether the request is allowed and how many remain.
 */

import { Redis } from "ioredis";

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env["REDIS_URL"];
  if (!url) return null;
  if (!redisClient) {
    redisClient = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true });
  }
  return redisClient;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * @param key     Unique identifier (e.g. `ip:<ip>`, `user:<id>`)
 * @param limit   Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    // Redis unavailable — fail open (don't block requests)
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number | undefined) ?? 0;

  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetAt: now + windowMs,
  };
}

/** Convenience: per-IP rate limit for API routes. 60 req/min by default. */
export async function rateLimitByIp(
  ip: string,
  opts: { limit?: number; windowMs?: number } = {}
): Promise<RateLimitResult> {
  return rateLimit(`ip:${ip}`, opts.limit ?? 60, opts.windowMs ?? 60_000);
}

/** Per-user rate limit — tighter than IP-based. */
export async function rateLimitByUser(
  userId: string,
  opts: { limit?: number; windowMs?: number } = {}
): Promise<RateLimitResult> {
  return rateLimit(`user:${userId}`, opts.limit ?? 100, opts.windowMs ?? 60_000);
}
