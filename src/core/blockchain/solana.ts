// src/core/blockchain/solana.ts
import { Connection, PublicKey, TransactionError } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const getRpcUrl = () => {
  if (typeof window === "undefined") {
    return process.env.SOLANA_RPC_PRIVATE || "https://mainnet.helius-rpc.com";
  }
  return "https://mainnet.helius-rpc.com";
};

export class SolanaVerificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "SolanaVerificationError";
  }
}

const CREATOR_LOOKUP_PAGE_SIZE = 1000;
const CREATOR_LOOKUP_MAX_PAGES = 25;

export async function getTokenCreatorWallet(mint: string): Promise<string | null> {
  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const mintPubkey = new PublicKey(mint);

    let before: string | undefined;
    let oldestPage: { signature: string }[] = [];

    for (let page = 0; page < CREATOR_LOOKUP_MAX_PAGES; page++) {
      const signatures = await connection.getSignaturesForAddress(mintPubkey, {
        before,
        limit: CREATOR_LOOKUP_PAGE_SIZE,
      });

      if (signatures.length === 0) break;

      oldestPage = signatures;
      before = signatures[signatures.length - 1].signature;

      if (signatures.length < CREATOR_LOOKUP_PAGE_SIZE) break;
    }

    const oldestSignature = oldestPage[oldestPage.length - 1]?.signature;
    if (!oldestSignature) return null;

    const tx = await connection.getParsedTransaction(oldestSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    const feePayer = tx?.transaction.message.accountKeys[0]?.pubkey;
    return feePayer ? feePayer.toBase58() : null;
  } catch (error: any) {
    console.error("[Blockchain] getTokenCreatorWallet failed:", error?.message || error);
    return null;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    await connection.getSlot();
    return true;
  } catch (error: any) {
    console.error("Connection test failed:", error?.message || error);
    return false;
  }
}

export interface VerifyPurchaseOptions {
  userWallet: string;
  treasuryWallet: string;
  tokenMint: string;
  expectedAmount: number;
  decimals: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export async function verifyPurchaseOnChain(
  signature: string,
  options: VerifyPurchaseOptions
): Promise<{ success: boolean; error?: string; details?: any }> {
  const {
    userWallet,
    treasuryWallet,
    tokenMint,
    expectedAmount,
    decimals,
    maxRetries = 5,
    retryDelayMs = 1500,
  } = options;

  const connection = new Connection(getRpcUrl(), "confirmed");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx) {
        if (attempt === maxRetries) {
          return {
            success: false,
            error: "Transaction not found",
            details: { hint: "Please wait a few seconds and check your wallet history" }
          };
        }
        await new Promise(res => setTimeout(res, retryDelayMs * (attempt + 1)));
        continue;
      }

      if (tx.meta?.err) {
        const txError = tx.meta.err as TransactionError;
        return {
          success: false,
          error: "Transaction failed on-chain",
          details: { instructionError: txError }
        };
      }

      const userPubkey = new PublicKey(userWallet);
      const treasuryPubkey = new PublicKey(treasuryWallet);
      const mintPubkey = new PublicKey(tokenMint);

      const tokenPrograms = [TOKEN_PROGRAM_ID];
      const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
      tokenPrograms.push(TOKEN_2022_PROGRAM_ID);

      let userATA: PublicKey | null = null;
      let treasuryATA: PublicKey | null = null;
      let activeProgramId: PublicKey | null = null;

      for (const programId of tokenPrograms) {
        try {
          const [uATA, tATA] = await Promise.all([
            getAssociatedTokenAddress(mintPubkey, userPubkey, false, programId),
            getAssociatedTokenAddress(mintPubkey, treasuryPubkey, true, programId),
          ]);

          const postBalances = tx.meta?.postTokenBalances || [];
          const userHasBalance = postBalances.some((tb: any) =>
            tb.mint === tokenMint && tb.owner === userWallet && tb.uiTokenAmount?.amount !== "0"
          );
          const treasuryReceived = postBalances.some((tb: any) =>
            tb.mint === tokenMint && tb.owner === treasuryWallet
          );

          if (treasuryReceived) {
            userATA = uATA;
            treasuryATA = tATA;
            activeProgramId = programId;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!userATA || !treasuryATA || !activeProgramId) {
        return {
          success: false,
          error: "Token transfer not found",
          details: { userWallet, treasuryWallet, tokenMint }
        };
      }

      const expectedRaw = BigInt(expectedAmount) * BigInt(10 ** decimals);

      const innerInstructions = tx.meta?.innerInstructions || [];
      let transferFound = false;

      for (const inner of innerInstructions) {
        for (const instruction of inner.instructions) {
          if ("parsed" in instruction && instruction.parsed.type === "transfer") {
            const info = instruction.parsed.info;
            if (
              info.source === userATA.toBase58() &&
              info.destination === treasuryATA.toBase58() &&
              BigInt(info.tokenAmount?.amount || 0) >= expectedRaw
            ) {
              transferFound = true;
              break;
            }
          }
        }
        if (transferFound) break;
      }

      if (!transferFound) {
        return {
          success: false,
          error: "Transfer amount mismatch",
          details: {
            expected: expectedRaw.toString(),
            found: innerInstructions.map(i => i.instructions).flat()
          }
        };
      }

      const accountKeys = tx.transaction.message.accountKeys;
      const signerPubkey = accountKeys[0]?.pubkey?.toString();

      if (!signerPubkey || signerPubkey !== userWallet) {
        return {
          success: false,
          error: "Transaction signed by wrong wallet",
          details: { expected: userWallet, got: signerPubkey }
        };
      }

      return { success: true };

    } catch (error: any) {
      lastError = error;

      if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
        await new Promise(res => setTimeout(res, retryDelayMs * 3 * (attempt + 1)));
        continue;
      }

      if (error.message?.includes("Transaction not found") ||
        error.message?.includes("slot")) {
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, retryDelayMs * (attempt + 1)));
          continue;
        }
      }

      console.error("Solana RPC error:", error);
      return {
        success: false,
        error: "RPC error",
        details: { message: error?.message || String(error) }
      };
    }
  }

  return {
    success: false,
    error: "Verification timeout",
    details: { lastError: lastError?.message }
  };
}