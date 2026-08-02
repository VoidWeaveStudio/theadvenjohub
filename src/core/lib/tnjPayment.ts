// src/core/lib/tnjPayment.ts
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { db } from "@/core/database";
import { gameLicenses, marketplacePurchases, factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export interface TnjPaymentVerifyParams {
  signature: string;
  expectedAmountTnj: number;
  expectedSigner: string;
}

export type TnjPaymentVerifyResult =
  | { ok: true; tx: ParsedTransactionWithMeta }
  | { ok: false; error: string; status: number; details?: unknown };

// Extracted from app/api/purchase/verify/route.ts so the same fragile on-chain
// parsing (retry, postTokenBalances/innerInstructions fallback, signer check)
// isn't duplicated for every new TNJ-gated feature.
export async function verifyTnjTransferToTreasury(
  params: TnjPaymentVerifyParams
): Promise<TnjPaymentVerifyResult> {
  const { signature, expectedAmountTnj, expectedSigner } = params;

  const treasuryWallet = process.env.TREASURY_WALLET_ADDRESS?.trim();
  const tokenMint = process.env.TNJ_TOKEN_MINT_ADDRESS?.trim();
  const rpcUrl = process.env.SOLANA_RPC_PRIVATE?.trim() || "https://mainnet.helius-rpc.com";
  const decimals = Number.parseInt(process.env.TNJ_DECIMALS || "6", 10);

  if (!treasuryWallet || !tokenMint) {
    console.error("[tnjPayment] Missing env config:", { treasuryWallet, tokenMint });
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
      // retry
    }
    await new Promise((res) => setTimeout(res, 1000 * Math.min(2 ** attempt, 8)));
  }

  if (!tx) {
    return {
      ok: false, error: "transaction_not_found", status: 400,
      details: { hint: "Wait 10-15 seconds and retry" },
    };
  }

  if (tx.meta?.err) {
    return { ok: false, error: "transaction_failed", status: 400, details: tx.meta.err };
  }

  const expectedAmount = BigInt(expectedAmountTnj) * (10n ** BigInt(decimals));
  let transferFound = false;

  if (tx.meta?.postTokenBalances) {
    for (const tb of tx.meta.postTokenBalances) {
      const isCorrectMint = tb.mint === tokenMint;
      const isTreasuryOwner = tb.owner === treasuryWallet;

      if (isCorrectMint && isTreasuryOwner) {
        const postAmount = BigInt(tb.uiTokenAmount?.amount || "0");
        const preTB = tx.meta?.preTokenBalances?.find((p: any) =>
          p.mint === tokenMint && p.owner === treasuryWallet
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
              const expectedTreasuryATA = await getAssociatedTokenAddress(
                new PublicKey(tokenMint),
                new PublicKey(treasuryWallet),
                undefined,
                programId === TOKEN_2022_PROGRAM_ID.toString() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
              );

              if (destination === expectedTreasuryATA.toString()) {
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
      details: { expected: expectedAmount.toString(), hint: "Send tokens to treasury ATA (not wallet directly). Check mint matches." },
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

export type SignatureUse =
  | { kind: "license"; id: string }
  | { kind: "purchase"; id: string }
  | { kind: "faction_promo"; id: string };

// Cross-table anti-replay check. A single tx signature must only ever redeem
// ONE purchase, across all three tables that can consume one — without this,
// the same payment could be replayed as e.g. both a game license and a
// faction promo-code unlock.
export async function findExistingSignatureUse(signature: string): Promise<SignatureUse | null> {
  const [lic, purch, fact] = await Promise.all([
    db.query.gameLicenses.findFirst({ where: eq(gameLicenses.txSignature, signature) }),
    db.query.marketplacePurchases.findFirst({ where: eq(marketplacePurchases.txSignature, signature) }),
    db.query.factions.findFirst({ where: eq(factions.promoCodePurchaseTx, signature) }),
  ]);
  if (lic) return { kind: "license", id: lic.id };
  if (purch) return { kind: "purchase", id: purch.id };
  if (fact) return { kind: "faction_promo", id: fact.id };
  return null;
}
