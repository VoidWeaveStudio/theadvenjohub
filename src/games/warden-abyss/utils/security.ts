//src\games\warden-abyss\utils\security.ts
import { PublicKey } from "@solana/web3.js";

export const RATE_LIMIT_MS = 30 * 60 * 1000;
export const SYNC_RETRY_DELAY = 2000;
export const MAX_SYNC_RETRIES = 3;

export function validateWallet(wallet: unknown): string {
  if (!wallet || typeof wallet !== "string") {
    throw new Error("Invalid wallet: must be a non-empty string");
  }

  const trimmed = wallet.trim();
  if (trimmed.length === 0) {
    throw new Error("Invalid wallet: empty string");
  }

  try {
    const key = new PublicKey(trimmed);
    return key.toBase58();
  } catch {
    throw new Error("Invalid wallet: not a valid Solana Base58 address");
  }
}

export async function verifySession(wallet: string): Promise<{ userId: string; wallet: string }> {
  const validWallet = validateWallet(wallet);

  const { db } = await import("@/core/database");
  const { users } = await import("@/core/database/schema");
  const { eq } = await import("drizzle-orm");

  const existingUser = await db.query.users.findFirst({
    where: eq(users.wallet, validWallet),
    columns: { id: true, wallet: true }
  });

  if (!existingUser) {
    throw new Error("Unauthorized: user not found in database");
  }

  return {
    userId: existingUser.id,
    wallet: existingUser.wallet
  };
}

export function checkRateLimit(lastActionAt: Date | null): { remainingMs: number; retryAfter: Date } | null {
  if (!lastActionAt) return null;

  const now = new Date();
  const elapsed = now.getTime() - lastActionAt.getTime();
  const remaining = RATE_LIMIT_MS - elapsed;

  if (remaining > 0) {
    return {
      remainingMs: remaining,
      retryAfter: new Date(lastActionAt.getTime() + RATE_LIMIT_MS)
    };
  }

  return null;
}

export function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  }
  return `${seconds} сек`;
}

export class RateLimitError extends Error {
  public readonly retryAfter: Date;
  public readonly remainingMs: number;

  constructor(remainingMs: number, retryAfter: Date) {
    super(`Rate limit exceeded. Try again in ${formatTimeRemaining(remainingMs)}`);
    this.name = "RateLimitError";
    this.remainingMs = remainingMs;
    this.retryAfter = retryAfter;
  }
}