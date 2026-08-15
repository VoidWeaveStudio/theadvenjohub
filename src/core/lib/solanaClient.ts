// src/core/lib/solanaClient.ts
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_PATH = "/api/solana/rpc";
const CONFIRM_POLL_INTERVAL_MS = 2000;
const CONFIRM_TIMEOUT_MS = 60_000;
const BLOCK_HEIGHT_CHECK_EVERY = 5;

export function getRpcEndpoint(): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return `${window.location.origin}${RPC_PATH}`;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  return configured ? `${configured}${RPC_PATH}` : `http://localhost:3000${RPC_PATH}`;
}

export function createRpcConnection(): Connection {
  return new Connection(getRpcEndpoint(), { commitment: "confirmed" });
}

export async function readTokenAccountBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  const accountInfo = await connection.getAccountInfo(ata, "confirmed");
  if (!accountInfo) throw new Error("Token account not found");

  const data = accountInfo.data;
  if (data.length < 72) throw new Error("Invalid token account data");

  return (
    BigInt(data[64]) |
    (BigInt(data[65]) << 8n) |
    (BigInt(data[66]) << 16n) |
    (BigInt(data[67]) << 24n) |
    (BigInt(data[68]) << 32n) |
    (BigInt(data[69]) << 40n) |
    (BigInt(data[70]) << 48n) |
    (BigInt(data[71]) << 56n)
  );
}

export async function confirmSignature(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number
): Promise<boolean> {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < CONFIRM_TIMEOUT_MS) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];

    if (status?.err) {
      throw new Error("Transaction failed on-chain");
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return true;
    }

    if (attempt > 0 && attempt % BLOCK_HEIGHT_CHECK_EVERY === 0) {
      const blockHeight = await connection.getBlockHeight("confirmed").catch(() => null);
      if (blockHeight !== null && blockHeight > lastValidBlockHeight) {
        return false;
      }
    }

    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_INTERVAL_MS));
  }

  return false;
}
