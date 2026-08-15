// src/core/lib/tnjPayment.ts
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { db } from "@/core/database";
import { gameLicenses, marketplacePurchases, factions, factionGates, trades } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const DEFAULT_MAX_PAYMENT_AGE_SECONDS = 60 * 60;
const MAX_CLOCK_SKEW_SECONDS = 120;

export interface TnjPaymentVerifyParams {
  signature: string;
  expectedAmountTnj: number;
  expectedSigner: string;
  maxAgeSeconds?: number;
}

export interface TnjTransferVerifyParams extends TnjPaymentVerifyParams {
  expectedRecipient: string;
}

export type TnjPaymentVerifyResult =
  | { ok: true; tx: ParsedTransactionWithMeta }
  | { ok: false; error: string; status: number; details?: unknown; retryable?: boolean };


export async function verifyTnjTransfer(
  params: TnjTransferVerifyParams
): Promise<TnjPaymentVerifyResult> {
  const {
    signature,
    expectedAmountTnj,
    expectedSigner,
    expectedRecipient,
    maxAgeSeconds = DEFAULT_MAX_PAYMENT_AGE_SECONDS,
  } = params;

  const tokenMint = process.env.TNJ_TOKEN_MINT_ADDRESS?.trim();
  const rpcUrl = process.env.SOLANA_RPC_PRIVATE?.trim();
  const decimals = Number.parseInt(process.env.TNJ_DECIMALS || "6", 10);

  if (!expectedRecipient || !tokenMint || !rpcUrl) {
    console.error("[tnjPayment] Missing config:", { expectedRecipient, tokenMint, hasRpcUrl: !!rpcUrl });
    return { ok: false, error: "server_config_error", status: 500 };
  }

  const connection = new Connection(rpcUrl, "confirmed");

  let tx: ParsedTransactionWithMeta | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (tx) break;
    } catch {
    }
    await new Promise((res) => setTimeout(res, 1000 * Math.min(2 ** attempt, 8)));
  }

  if (!tx) {
    return {
      ok: false, error: "transaction_not_found", status: 400, retryable: true,
      details: { hint: "Wait 10-15 seconds and retry" },
    };
  }

  if (tx.meta?.err) {
    return { ok: false, error: "transaction_failed", status: 400, details: tx.meta.err };
  }

  if (typeof tx.blockTime !== "number") {
    return {
      ok: false, error: "payment_timestamp_unavailable", status: 400, retryable: true,
      details: { hint: "Wait a few seconds and retry" },
    };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;

  if (ageSeconds > maxAgeSeconds) {
    return {
      ok: false, error: "payment_too_old", status: 400,
      details: { ageSeconds, maxAgeSeconds },
    };
  }

  if (ageSeconds < -MAX_CLOCK_SKEW_SECONDS) {
    return {
      ok: false, error: "payment_timestamp_invalid", status: 400,
      details: { ageSeconds },
    };
  }

  const expectedAmount = BigInt(expectedAmountTnj) * (10n ** BigInt(decimals));
  let transferFound = false;

  if (tx.meta?.postTokenBalances) {
    for (const tb of tx.meta.postTokenBalances) {
      const isCorrectMint = tb.mint === tokenMint;
      const isRecipientOwner = tb.owner === expectedRecipient;

      if (isCorrectMint && isRecipientOwner) {
        const postAmount = BigInt(tb.uiTokenAmount?.amount || "0");
        const preTB = tx.meta?.preTokenBalances?.find((p: any) =>
          p.mint === tokenMint && p.owner === expectedRecipient
        );
        const preAmount = preTB ? BigInt(preTB.uiTokenAmount?.amount || "0") : 0n;
        const received = postAmount - preAmount;

        if (received >= expectedAmount) {
          transferFound = true;
          break;
        }
      }
    }
  }

  if (!transferFound && tx.meta?.innerInstructions) {
    for (const ix of tx.meta.innerInstructions) {
      for (const inner of ix.instructions) {
        const programId = inner.programId?.toString();

        if (programId === TOKEN_PROGRAM_ID.toString() || programId === TOKEN_2022_PROGRAM_ID.toString()) {
          const parsed = (inner as any).parsed;

          if (parsed?.type === "transfer" && parsed?.info?.amount) {
            const transferAmount = BigInt(parsed.info.amount);
            const transferMint = parsed.info.mint;
            const destination = parsed.info.destination;

            if (transferMint === tokenMint && transferAmount >= expectedAmount) {
              const expectedRecipientATA = await getAssociatedTokenAddress(
                new PublicKey(tokenMint),
                new PublicKey(expectedRecipient),
                undefined,
                programId === TOKEN_2022_PROGRAM_ID.toString() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
              );

              if (destination === expectedRecipientATA.toString()) {
                transferFound = true;
                break;
              }
            }
          }
        }
      }
      if (transferFound) break;
    }
  }

  if (!transferFound) {
    return {
      ok: false, error: "transfer_verification_failed", status: 400,
      details: { expected: expectedAmount.toString(), hint: "Send tokens to the recipient's ATA (not wallet directly). Check mint matches." },
    };
  }

  const signer = tx.transaction.message.accountKeys[0]?.pubkey?.toString();
  if (!signer || signer !== expectedSigner) {
    console.warn("[tnjPayment] Wallet mismatch:", { expected: expectedSigner, got: signer });
    return {
      ok: false, error: "wrong_signer", status: 400,
      details: { expected: expectedSigner, got: signer },
    };
  }

  return { ok: true, tx };
}


export async function verifyTnjTransferToTreasury(
  params: TnjPaymentVerifyParams
): Promise<TnjPaymentVerifyResult> {
  const treasuryWallet = process.env.TREASURY_WALLET_ADDRESS?.trim();
  if (!treasuryWallet) {
    console.error("[tnjPayment] Missing env config: TREASURY_WALLET_ADDRESS");
    return { ok: false, error: "server_config_error", status: 500 };
  }
  return verifyTnjTransfer({ ...params, expectedRecipient: treasuryWallet });
}

export type SignatureUse =
  | { kind: "license"; id: string }
  | { kind: "purchase"; id: string }
  | { kind: "faction_promo"; id: string }
  | { kind: "faction_creation"; id: string }
  | { kind: "faction_gate"; id: string }
  | { kind: "trade"; id: string };


export async function findExistingSignatureUse(signature: string): Promise<SignatureUse | null> {
  const [lic, purch, factPromo, factCreation, factGate, trade] = await Promise.all([
    db.query.gameLicenses.findFirst({ where: eq(gameLicenses.txSignature, signature) }),
    db.query.marketplacePurchases.findFirst({ where: eq(marketplacePurchases.txSignature, signature) }),
    db.query.factions.findFirst({ where: eq(factions.promoCodePurchaseTx, signature) }),
    db.query.factions.findFirst({ where: eq(factions.creationTx, signature) }),
    db.query.factionGates.findFirst({ where: eq(factionGates.purchaseTx, signature) }),
    db.query.trades.findFirst({ where: eq(trades.txSignature, signature) }),
  ]);
  if (lic) return { kind: "license", id: lic.id };
  if (purch) return { kind: "purchase", id: purch.id };
  if (factPromo) return { kind: "faction_promo", id: factPromo.id };
  if (factCreation) return { kind: "faction_creation", id: factCreation.id };
  if (factGate) return { kind: "faction_gate", id: factGate.id };
  if (trade) return { kind: "trade", id: trade.id };
  return null;
}
