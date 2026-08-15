// src/core/auth/lib/revocation.ts
import { getCache, setCache, deleteCache } from "@/core/lib/cache";

const REVOCATION_TTL_SECONDS = 7 * 24 * 60 * 60;

function revocationKey(userId: string): string {
  return `auth:revoked:${userId}`;
}

export async function revokeSessions(userId: string): Promise<void> {
  if (!userId) return;
  await setCache(revocationKey(userId), Math.floor(Date.now() / 1000), REVOCATION_TTL_SECONDS);
}

export async function clearRevocation(userId: string): Promise<void> {
  if (!userId) return;
  await deleteCache(revocationKey(userId));
}

export async function isSessionRevoked(userId: string, issuedAt?: number): Promise<boolean> {
  if (!userId) return false;

  const revokedAt = await getCache<number>(revocationKey(userId));
  if (typeof revokedAt !== "number") return false;
  if (typeof issuedAt !== "number") return true;

  return issuedAt <= revokedAt;
}
