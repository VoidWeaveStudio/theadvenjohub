// src/core/auth/lib/desktopCode.ts
import { createHash, randomBytes } from "crypto";
import { Redis } from "@upstash/redis";

const CODE_TTL_SECONDS = 60;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export interface DesktopCodePayload {
  userId: string;
  wallet: string;
  codeChallenge: string;
}

interface StoredCode {
  userId: string;
  wallet: string;
  codeChallenge: string;
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

function codeKey(code: string): string {
  return `auth:desktop-code:${code}`;
}

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && CODE_CHALLENGE_PATTERN.test(value);
}

export function deriveChallenge(codeVerifier: string): string {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

export async function issueDesktopCode(payload: DesktopCodePayload): Promise<string> {
  const code = base64Url(randomBytes(32));

  const stored: StoredCode = {
    userId: payload.userId,
    wallet: payload.wallet,
    codeChallenge: payload.codeChallenge,
  };

  await getRedis().set(codeKey(code), stored, { ex: CODE_TTL_SECONDS });
  return code;
}

export async function redeemDesktopCode(
  code: string,
  codeVerifier: string
): Promise<{ userId: string; wallet: string } | null> {
  if (!code || !isValidCodeChallenge(codeVerifier)) return null;

  const client = getRedis();
  const key = codeKey(code);
  const stored = await client.get<StoredCode>(key);

  await client.del(key);

  if (!stored?.userId || !stored?.wallet || !stored?.codeChallenge) return null;
  if (deriveChallenge(codeVerifier) !== stored.codeChallenge) return null;

  return { userId: stored.userId, wallet: stored.wallet };
}
