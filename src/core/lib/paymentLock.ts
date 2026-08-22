// src/core/lib/paymentLock.ts
import { Redis } from "@upstash/redis";

const CLAIM_TTL_SECONDS = 120;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function claimKey(signature: string): string {
  return `payment:signature:${signature}`;
}

export async function claimSignature(signature: string, owner: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return true;

  try {
    const key = claimKey(signature);
    const claimed = await client.set(key, owner, { nx: true, ex: CLAIM_TTL_SECONDS });
    if (claimed === "OK") return true;

    const current = await client.get<string>(key);
    return current === owner;
  } catch (error) {
    console.error("[paymentLock] Claim failed:", error);
    return true;
  }
}
