// src/core/blockchain/solana.ts
import { Connection, PublicKey } from "@solana/web3.js";

const getRpcUrl = () => {
  const rpcUrl = process.env.SOLANA_RPC_PRIVATE;
  if (!rpcUrl) {
    throw new Error("Solana RPC URL is not configured");
  }
  return rpcUrl;
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


export async function getTokenBalance(wallet: string, mint: string): Promise<number> {
  const connection = new Connection(getRpcUrl(), "confirmed");
  const walletPubkey = new PublicKey(wallet);
  const mintPubkey = new PublicKey(mint);

  const { value } = await connection.getParsedTokenAccountsByOwner(walletPubkey, { mint: mintPubkey });

  let total = 0;
  for (const { account } of value) {
    const amount = account.data.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amount === "number") total += amount;
  }
  return total;
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
