// src/core/auth/lib/pendingSignIn.ts
const STORAGE_KEY = "tanjo_pending_signin";
const PENDING_TTL_MS = 10 * 60 * 1000;

export interface PendingSignIn {
  walletName: string;
  startedAt: number;
}

export function savePendingSignIn(walletName: string): void {
  if (typeof window === "undefined") return;

  try {
    const payload: PendingSignIn = { walletName, startedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
}

export function readPendingSignIn(): PendingSignIn | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingSignIn>;
    if (typeof parsed?.walletName !== "string" || typeof parsed?.startedAt !== "number") {
      clearPendingSignIn();
      return null;
    }

    if (Date.now() - parsed.startedAt > PENDING_TTL_MS) {
      clearPendingSignIn();
      return null;
    }

    return { walletName: parsed.walletName, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

export function clearPendingSignIn(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
