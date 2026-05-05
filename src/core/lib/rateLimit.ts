//src\core\lib\rateLimit.ts
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Redis not configured for rate limiting, using in-memory fallback');
    }
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export async function checkRateLimit(
  identifier: string,
  options: {
    maxAttempts?: number;
    windowMs?: number;
    prefix?: string;
  } = {}
): Promise<RateLimitResult> {
  const {
    maxAttempts = 5,
    windowMs = 10 * 60 * 1000,
    prefix = 'rl',
  } = options;

  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const r = getRedis();

  if (r) {
    try {
      const pipeline = r.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      const [current, ttl] = await pipeline.exec() as [number, number];

      const resetAt = now + (ttl * 1000);
      const remaining = Math.max(0, maxAttempts - current);

      return {
        allowed: current <= maxAttempts,
        remaining,
        resetAt,
        limit: maxAttempts,
      };
    } catch (err) {
      console.warn('Redis rate limit failed, falling back to memory:', err);
    }
  }

  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(key, newRecord);

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newRecord.resetAt,
      limit: maxAttempts,
    };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      limit: maxAttempts,
    };
  }

  record.count += 1;
  memoryStore.set(key, record);

  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetAt: record.resetAt,
    limit: maxAttempts,
  };
}

export async function resetRateLimit(identifier: string, prefix = 'rl'): Promise<void> {
  const key = `${prefix}:${identifier}`;
  const r = getRedis();

  if (r) {
    try {
      await r.del(key);
      return;
    } catch (err) {
      console.warn('Redis reset failed:', err);
    }
  }

  memoryStore.delete(key);
}

export function formatRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': result.allowed ? '0' : String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  };
}