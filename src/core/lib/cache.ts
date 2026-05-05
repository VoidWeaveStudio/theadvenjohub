//src\core\lib\cache.ts
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Redis not configured, using in-memory fallback (dev only)');
    }
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

const isProd = process.env.NODE_ENV === 'production';
const USE_MEMORY_FALLBACK = !isProd;

const MAX_CACHE_SIZE = 1000;
const CLEANUP_INTERVAL = 60000;

interface CacheEntry<T> {
  data: T;
  expires: number;
  lastAccessed: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const accessOrder: string[] = [];

function touchKey(key: string) {
  const idx = accessOrder.indexOf(key);
  if (idx > -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);
}

function evictOldest() {
  while (accessOrder.length > 0 && memoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = accessOrder.shift();
    if (oldest) memoryCache.delete(oldest);
  }
}

function cleanup() {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now > value.expires) {
      memoryCache.delete(key);
      const idx = accessOrder.indexOf(key);
      if (idx > -1) accessOrder.splice(idx, 1);
    }
  }
  while (memoryCache.size > MAX_CACHE_SIZE) {
    evictOldest();
  }
}

if (USE_MEMORY_FALLBACK) {
  setInterval(cleanup, CLEANUP_INTERVAL);
}

export async function getCache<T>(key: string): Promise<T | null> {
  const r = getRedis();

  if (r) {
    try {
      const data = await r.get<T>(`cache:${key}`);
      if (data !== null) {
        if (USE_MEMORY_FALLBACK) touchKey(key);
      }
      return data;
    } catch (err) {
      if (!isProd) {
        console.warn('Redis get failed, falling back to memory:', err);
      } else {
        console.error('Redis get failed in production:', err);
      }
    }
  }

  if (USE_MEMORY_FALLBACK) {
    const item = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (item && item.expires > Date.now()) {
      touchKey(key);
      return item.data;
    }
    if (item) {
      memoryCache.delete(key);
      const idx = accessOrder.indexOf(key);
      if (idx > -1) accessOrder.splice(idx, 1);
    }
  }

  return null;
}

export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  const expires = Date.now() + ttlSeconds * 1000;

  if (r) {
    try {
      await r.set(`cache:${key}`, data, { ex: ttlSeconds });

      if (USE_MEMORY_FALLBACK) {
        memoryCache.set(key, { data, expires, lastAccessed: Date.now() });
        touchKey(key);
        evictOldest();
      }
      return;
    } catch (err) {
      if (!isProd) {
        console.warn('Redis set failed, falling back to memory:', err);
      } else {
        console.error('Redis set failed in production:', err);
        return;
      }
    }
  }

  if (USE_MEMORY_FALLBACK) {
    memoryCache.set(key, { data, expires, lastAccessed: Date.now() });
    touchKey(key);
    evictOldest();
  }
}

export async function deleteCache(key: string): Promise<void> {
  const r = getRedis();

  if (r) {
    try {
      await r.del(`cache:${key}`);
    } catch (err) {
      if (!isProd) {
        console.warn('Redis del failed:', err);
      } else {
        console.error('Redis del failed in production:', err);
      }
    }
  }

  if (USE_MEMORY_FALLBACK) {
    memoryCache.delete(key);
    const idx = accessOrder.indexOf(key);
    if (idx > -1) accessOrder.splice(idx, 1);
  }
}

export function clearMemoryCache(): void {
  if (USE_MEMORY_FALLBACK) {
    memoryCache.clear();
    accessOrder.length = 0;
  }
}

export function getCacheStats(): { size: number; keys: string[] } | null {
  if (!USE_MEMORY_FALLBACK) return null;

  return {
    size: memoryCache.size,
    keys: [...accessOrder].slice(-10),
  };
}