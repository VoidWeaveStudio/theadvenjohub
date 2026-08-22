// src/core/blockchain/payTnj.ts
import type { Adapter } from "@solana/wallet-adapter-base";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { confirmSignature, createRpcConnection, readTokenAccountBalance } from "@/core/lib/solanaClient";

export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export type PayTnjErrorCode =
  | "wallet_not_connected"
  | "invalid_amount"
  | "config_failed"
  | "no_token_account"
  | "insufficient_balance"
  | "user_rejected"
  | "send_failed";

export type PayStage = "preparing" | "signing" | "confirming";

export interface PaymentConfig {
  treasuryWallet: string;
  tokenMint: string;
  decimals: number;
}

export interface PayTnjParams {
  adapter: Adapter | null | undefined;
  payer: PublicKey | null | undefined;
  amountTnj: number;
  recipient?: string;
  onStage?: (stage: PayStage) => void;
  signal?: AbortSignal;
}

export class PayTnjError extends Error {
  readonly code: PayTnjErrorCode;
  readonly balanceTnj?: number;
  readonly requiredTnj?: number;

  constructor(code: PayTnjErrorCode, options?: { balanceTnj?: number; requiredTnj?: number; cause?: unknown }) {
    super(code);
    this.name = "PayTnjError";
    this.code = code;
    this.balanceTnj = options?.balanceTnj;
    this.requiredTnj = options?.requiredTnj;
  }
}

let configCache: PaymentConfig | null = null;

export async function loadPaymentConfig(signal?: AbortSignal): Promise<PaymentConfig> {
  if (configCache) return configCache;

  const res = await fetch("/api/marketplace/config", { signal });
  if (!res.ok) throw new PayTnjError("config_failed");

  const raw = await res.json().catch(() => null);
  if (!raw?.treasuryWallet || !raw?.tokenMint) throw new PayTnjError("config_failed");

  const decimals = Number.parseInt(raw.decimals ?? "6", 10);
  configCache = {
    treasuryWallet: raw.treasuryWallet,
    tokenMint: raw.tokenMint,
    decimals: Number.isFinite(decimals) ? decimals : 6,
  };

  return configCache;
}

function isUserRejection(error: unknown): boolean {
  const err = error as { code?: number; message?: string; name?: string } | null;
  if (!err) return false;
  if (err.code === 4001) return true;
  if (err.name === "WalletSignTransactionError" && /reject|denied|cancel/i.test(err.message ?? "")) return true;
  return /user rejected|user denied|rejected the request|declined|cancell?ed/i.test(err.message ?? "");
}

function supportsVersionedTx(adapter: Adapter): boolean {
  const versions = adapter.supportedTransactionVersions;
  return Boolean(versions && versions.has(0));
}

async function buildTransfer(
  adapter: Adapter,
  connection: Connection,
  payer: PublicKey,
  config: PaymentConfig,
  amount: bigint,
  recipient: string
): Promise<{ transaction: Transaction | VersionedTransaction; lastValidBlockHeight: number }> {
  const mint = new PublicKey(config.tokenMint);
  const destination = new PublicKey(recipient);

  const payerAta = await getAssociatedTokenAddress(mint, payer, false, TOKEN_2022_PROGRAM_ID);
  const destinationAta = await getAssociatedTokenAddress(mint, destination, true, TOKEN_2022_PROGRAM_ID);

  let balance: bigint;
  try {
    balance = await readTokenAccountBalance(connection, payerAta);
  } catch {
    throw new PayTnjError("no_token_account");
  }

  if (balance < amount) {
    throw new PayTnjError("insufficient_balance", {
      balanceTnj: Number(balance) / 10 ** config.decimals,
      requiredTnj: Number(amount) / 10 ** config.decimals,
    });
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const instruction = createTransferInstruction(
    payerAta,
    destinationAta,
    payer,
    amount,
    [],
    TOKEN_2022_PROGRAM_ID
  );

  if (supportsVersionedTx(adapter)) {
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    return { transaction: new VersionedTransaction(message), lastValidBlockHeight };
  }

  const legacy = new Transaction({ feePayer: payer, recentBlockhash: blockhash }).add(instruction);
  return { transaction: legacy, lastValidBlockHeight };
}

export async function payTnj({
  adapter,
  payer,
  amountTnj,
  recipient,
  onStage,
  signal,
}: PayTnjParams): Promise<string> {
  if (!adapter || !payer) throw new PayTnjError("wallet_not_connected");
  if (!Number.isInteger(amountTnj) || amountTnj <= 0) throw new PayTnjError("invalid_amount");
  if (typeof adapter.sendTransaction !== "function") throw new PayTnjError("wallet_not_connected");

  onStage?.("preparing");

  const config = await loadPaymentConfig(signal);
  const connection = createRpcConnection();
  const amount = BigInt(amountTnj) * 10n ** BigInt(config.decimals);

  const { transaction, lastValidBlockHeight } = await buildTransfer(
    adapter,
    connection,
    payer,
    config,
    amount,
    recipient ?? config.treasuryWallet
  );

  onStage?.("signing");

  let signature: string;
  try {
    signature = await adapter.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch (error) {
    if (isUserRejection(error)) throw new PayTnjError("user_rejected", { cause: error });
    throw new PayTnjError("send_failed", { cause: error });
  }

  onStage?.("confirming");

  try {
    await confirmSignature(connection, signature, lastValidBlockHeight);
  } catch {
  }

  return signature;
}
