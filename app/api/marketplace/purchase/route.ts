//app\api\marketplace\purchase\route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { marketplacePurchases, marketplaceLots } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const verifySchema = z.object({
  signature: z.string().min(80).max(100),
  lotId: z.string().uuid("Invalid lot ID format")
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`marketplace:purchase:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:marketplace:purchase",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many purchase attempts. Please wait.",
          retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...formatRateLimitHeaders(rl),
          },
        }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: authResult.status,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    if (!verifyCSRF(req)) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        {
          status: 403,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const { user } = authResult;
    const body = await req.json();
    const { signature, lotId } = verifySchema.parse(body);

    const treasuryWallet =
      process.env.TREASURY_WALLET_ADDRESS?.trim() ||
      process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS?.trim();
    const tokenMint =
      process.env.TNJ_TOKEN_MINT_ADDRESS?.trim() ||
      process.env.NEXT_PUBLIC_TNJ_TOKEN_MINT_ADDRESS?.trim();
    const decimalsStr =
      process.env.TNJ_DECIMALS?.trim() ||
      process.env.NEXT_PUBLIC_TNJ_DECIMALS?.trim() ||
      "6";
    const decimals = parseInt(decimalsStr, 10);
    const rpcUrl = process.env.SOLANA_RPC_PRIVATE || "https://mainnet.helius-rpc.com";

    if (!treasuryWallet || !tokenMint) {
      return NextResponse.json(
        { error: "Server config error" },
        {
          status: 500,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const lot = await db.query.marketplaceLots.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.id, lotId),
    });

    if (!lot) {
      return NextResponse.json(
        { error: "Lot not found", lotId },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    if (lot.status !== "available") {
      return NextResponse.json(
        { error: "Lot not available", status: lot.status },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    if (lot.price <= 0 || lot.price > Number.MAX_SAFE_INTEGER / Math.pow(10, decimals)) {
      return NextResponse.json(
        { error: "Invalid price value" },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");

    let tx = null;
    let lastError = null;

    for (let i = 0; i < 8; i++) {
      try {
        tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        if (tx) {
          if (tx.meta?.err) {
            return NextResponse.json(
              { error: "Transaction failed on-chain", details: tx.meta.err },
              {
                status: 400,
                headers: formatRateLimitHeaders(rl),
              }
            );
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }

    if (!tx) {
      return NextResponse.json(
        {
          error: "Transaction not found",
          hint: "Please wait a few seconds and check your wallet history"
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const expectedAmount = BigInt(lot.price) * BigInt(Math.pow(10, decimals));

    const treasuryReceived = tx.meta?.postTokenBalances?.find((tb: any) =>
      tb.mint === tokenMint &&
      tb.owner === treasuryWallet
    );

    if (!treasuryReceived) {
      return NextResponse.json(
        { error: "Transfer not found" },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const receivedAmount = BigInt(treasuryReceived.uiTokenAmount?.amount || "0");

    if (receivedAmount < expectedAmount) {
      return NextResponse.json(
        {
          error: "Amount mismatch",
          expected: expectedAmount.toString(),
          received: receivedAmount.toString()
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const existing = await db.query.marketplacePurchases.findFirst({
      where: (p, { eq }) => eq(p.txSignature, signature),
    });
    if (existing) {
      return NextResponse.json(
        { success: true, purchaseId: existing.id },
        {
          status: 200,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const firstAccount = tx.transaction.message.accountKeys[0];
    const buyerWallet = user.wallet || String(firstAccount?.pubkey || firstAccount);
    const signerPubkey = firstAccount?.pubkey?.toString();

    if (signerPubkey !== user.wallet) {
      return NextResponse.json(
        {
          error: "Transaction signed by wrong wallet",
          expected: user.wallet,
          got: signerPubkey
        },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const insertResult = await db.insert(marketplacePurchases).values({
      userId: user.userId,
      wallet: buyerWallet,
      lotId: lot.id,
      txSignature: signature,
      amount: lot.price,
      status: "confirmed",
    }).returning();

    const newPurchase = insertResult[0];
    if (!newPurchase) {
      throw new Error("Failed to create purchase");
    }

    await db.update(marketplaceLots)
      .set({ status: "sold", updatedAt: new Date() })
      .where(eq(marketplaceLots.id, lot.id));

    return NextResponse.json(
      {
        success: true,
        purchaseId: newPurchase.id,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...formatRateLimitHeaders(rl),
        },
      }
    );

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("Unexpected error in purchase verification:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}