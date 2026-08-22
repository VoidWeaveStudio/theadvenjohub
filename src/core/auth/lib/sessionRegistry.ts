// src/core/auth/lib/sessionRegistry.ts
import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";

export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ABSOLUTE_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface SessionRecord {
  sid: string;
  jti: string;
  createdAt: number;
  lastSeenAt: number;
  device: string;
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function sessionKey(userId: string, sid: string): string {
  return `auth:session:${userId}:${sid}`;
}

function indexKey(userId: string): string {
  return `auth:sessions:${userId}`;
}

export function newSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function newTokenId(): string {
  return randomBytes(16).toString("hex");
}

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.slice(0, 400);
  const platform =
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Windows/i.test(ua) ? "Windows" :
    /Macintosh|Mac OS/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" :
    "Unknown";

  const browser =
    /Tauri|tanjo/i.test(ua) ? "TANJO Client" :
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\//i.test(ua) ? "Opera" :
    /Firefox/i.test(ua) ? "Firefox" :
    /Chrome/i.test(ua) ? "Chrome" :
    /Safari/i.test(ua) ? "Safari" :
    "Browser";

  return `${browser} · ${platform}`;
}

export async function registerSession(
  userId: string,
  record: Omit<SessionRecord, "lastSeenAt"> & { lastSeenAt?: number }
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const value: SessionRecord = { ...record, lastSeenAt: record.lastSeenAt ?? Date.now() };

  try {
    await client.set(sessionKey(userId, record.sid), value, { ex: REFRESH_TTL_SECONDS });
    await client.sadd(indexKey(userId), record.sid);
    await client.expire(indexKey(userId), ABSOLUTE_SESSION_TTL_SECONDS);
  } catch (error) {
    console.error("[sessionRegistry] Failed to register session:", error);
  }
}

export async function readSession(userId: string, sid: string): Promise<SessionRecord | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    return await client.get<SessionRecord>(sessionKey(userId, sid));
  } catch (error) {
    console.error("[sessionRegistry] Failed to read session:", error);
    return null;
  }
}

export async function rotateSession(
  userId: string,
  sid: string,
  nextJti: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const existing = await readSession(userId, sid);
  if (!existing) return;

  await registerSession(userId, {
    sid,
    jti: nextJti,
    createdAt: existing.createdAt,
    device: existing.device,
    lastSeenAt: Date.now(),
  });
}

export async function revokeSession(userId: string, sid: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(sessionKey(userId, sid));
    await client.srem(indexKey(userId), sid);
  } catch (error) {
    console.error("[sessionRegistry] Failed to revoke session:", error);
  }
}

export async function listSessions(userId: string): Promise<SessionRecord[]> {
  const client = getRedis();
  if (!client) return [];

  try {
    const ids = await client.smembers(indexKey(userId));
    if (!ids?.length) return [];

    const records = await Promise.all(ids.map((sid) => readSession(userId, sid)));
    const alive = records.filter((record): record is SessionRecord => Boolean(record));

    const staleIds = ids.filter((sid) => !alive.some((record) => record.sid === sid));
    if (staleIds.length > 0) {
      await client.srem(indexKey(userId), ...staleIds);
    }

    return alive.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  } catch (error) {
    console.error("[sessionRegistry] Failed to list sessions:", error);
    return [];
  }
}

export function isBeyondAbsoluteLifetime(createdAt: number): boolean {
  return Date.now() - createdAt > ABSOLUTE_SESSION_TTL_SECONDS * 1000;
}
