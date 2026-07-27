// src/core/lib/rateLimit.ts
import { Redis } from '@upstash/redis';

export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return 'unknown';
}

const INCR_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local pttl = redis.call("PTTL", KEYS[1])
return {current, pttl}
`;

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
      const [current, pttl] = await r.eval(
        INCR_WITH_TTL_SCRIPT,
        [key],
        [windowMs]
      ) as [number, number];

      const resetAt = now + (pttl > 0 ? pttl : windowMs);
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