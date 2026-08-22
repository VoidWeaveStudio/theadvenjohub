// src/core/blockchain/pendingPayment.ts
const STORAGE_KEY = "tanjo_pending_payments";
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingPayment {
  key: string;
  signature: string;
  amountTnj: number;
  createdAt: number;
}

type PendingMap = Record<string, PendingPayment>;

function readAll(): PendingMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as PendingMap;
    if (!parsed || typeof parsed !== "object") return {};

    const now = Date.now();
    const fresh: PendingMap = {};

    for (const [key, entry] of Object.entries(parsed)) {
      if (
        entry &&
        typeof entry.signature === "string" &&
        typeof entry.createdAt === "number" &&
        now - entry.createdAt < PENDING_TTL_MS
      ) {
        fresh[key] = entry;
      }
    }

    return fresh;
  } catch {
    return {};
  }
}

function writeAll(map: PendingMap): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

export function savePendingPayment(payment: Omit<PendingPayment, "createdAt">): void {
  const map = readAll();
  map[payment.key] = { ...payment, createdAt: Date.now() };
  writeAll(map);
}

export function readPendingPayment(key: string): PendingPayment | null {
  return readAll()[key] ?? null;
}

export function listPendingPayments(): PendingPayment[] {
  return Object.values(readAll()).sort((a, b) => a.createdAt - b.createdAt);
}

export function clearPendingPayment(key: string): void {
  const map = readAll();
  if (!(key in map)) return;

  delete map[key];
  writeAll(map);
}
