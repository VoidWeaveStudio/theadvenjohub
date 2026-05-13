//app\api\purchase\verify\route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { 
  gameLicenses, 
  marketplacePurchases, 
  marketplaceLots,
} from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const verifySchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  gameId: z.string().uuid("Invalid gameId format").optional(),
  lotId: z.string().uuid("Invalid lotId format").optional(),
  price: z.number().int().positive("Price must be positive"),
}).refine(data => data.gameId || data.lotId, {
  message: "Either gameId or lotId must be provided",
  path: ["gameId", "lotId"],
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    
    if (process.env.NODE_ENV === "development") {
      console.log("[purchase/verify] Request headers:", {
        hasCookie: !!req.cookies.get("token"),
        hasCsrfHeader: !!req.headers.get("x-csrf-token"),
        hasCsrfCookie: !!req.cookies.get("csrf_token"),
        contentType: req.headers.get("content-type"),
      });
    }
    
    const rl = await checkRateLimit(`purchase:verify:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:purchase:verify",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      if (process.env.NODE_ENV === "development") {
        const token = req.cookies.get("token")?.value;
        console.warn("[purchase/verify] Auth failed:", {
          hasToken: !!token,
          tokenLength: token?.length,
          response: authResult,
        });
      }
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: authResult.status, headers: formatRateLimitHeaders(rl) }
      );
    }
    const { user } = authResult;

    if (!verifyCSRF(req)) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[purchase/verify] CSRF failed:", {
          header: req.headers.get("x-csrf-token")?.slice(0, 8) + "...",
          cookie: req.cookies.get("csrf_token")?.value?.slice(0, 8) + "...",
        });
      }
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
    }

    const body = await req.json();
    const validation = verifySchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "validation_failed", details: validation.error.flatten() },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const { signature, gameId, lotId, price } = validation.data;

    const treasuryWallet = process.env.TREASURY_WALLET_ADDRESS?.trim();
    const tokenMint = process.env.TNJ_TOKEN_MINT_ADDRESS?.trim();
    const rpcUrl = process.env.SOLANA_RPC_PRIVATE?.trim() || "https://mainnet.helius-rpc.com";

    if (!treasuryWallet || !tokenMint) {
      console.error("[purchase/verify] Missing env config:", { treasuryWallet, tokenMint });
      return NextResponse.json(
        { error: "server_config_error" },
        { status: 500, headers: formatRateLimitHeaders(rl) }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");
    
    let tx: ParsedTransactionWithMeta | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        if (tx) break;
      } catch (err: any) {
        lastError = err;
      }
      await new Promise(res => setTimeout(res, 1000 * Math.min(2 ** attempt, 8)));
    }

    if (!tx) {
      return NextResponse.json(
        { error: "transaction_not_found", hint: "Wait 10-15 seconds and retry" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (tx.meta?.err) {
      return NextResponse.json(
        { error: "transaction_failed", details: tx.meta.err },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const expectedAmount = BigInt(price);
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
      return NextResponse.json(
        { 
          error: "transfer_verification_failed",
          expected: expectedAmount.toString(),
          hint: "Send tokens to treasury ATA (not wallet directly). Check mint matches."
        },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const signer = tx.transaction.message.accountKeys[0]?.pubkey?.toString();
    if (!signer || signer.toLowerCase() !== user.wallet.toLowerCase()) {
      console.warn("[purchase/verify] Wallet mismatch:", { 
        expected: user.wallet, 
        got: signer 
      });
      return NextResponse.json(
        { error: "wrong_signer", expected: user.wallet, got: signer },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (gameId) {
      const existing = await db.query.gameLicenses.findFirst({
        where: eq(gameLicenses.txSignature, signature),
      });
      if (existing) {
        return NextResponse.json({ success: true, type: "game", id: existing.id, alreadyProcessed: true });
      }
    }
    if (lotId) {
      const existing = await db.query.marketplacePurchases.findFirst({
        where: eq(marketplacePurchases.txSignature, signature),
      });
      if (existing) {
        return NextResponse.json({ success: true, type: "item", id: existing.id, alreadyProcessed: true });
      }
    }

    let result: { id: string; type: "game" | "item" };
    
    if (gameId) {
      const raceCheck = await db.query.gameLicenses.findFirst({
        where: eq(gameLicenses.txSignature, signature),
      });
      if (raceCheck) {
        return NextResponse.json({ success: true, type: "game", id: raceCheck.id, alreadyProcessed: true });
      }
      
      const [license] = await db.insert(gameLicenses).values({
        userId: user.userId, 
        gameId, 
        wallet: user.wallet,
        txSignature: signature, 
        price, 
        purchasedAt: new Date(), 
        isActive: true,
      }).returning();
      
      result = { id: license.id, type: "game" };
      
    } else if (lotId) {
      const raceCheck = await db.query.marketplacePurchases.findFirst({
        where: eq(marketplacePurchases.txSignature, signature),
      });
      if (raceCheck) {
        return NextResponse.json({ success: true, type: "item", id: raceCheck.id, alreadyProcessed: true });
      }
      
      const [purchase] = await db.insert(marketplacePurchases).values({
        userId: user.userId, 
        wallet: user.wallet, 
        lotId,
        txSignature: signature, 
        amount: price, 
        status: "confirmed",
      }).returning();
      
      await db.update(marketplaceLots)
        .set({ status: "sold", updatedAt: new Date() })
        .where(eq(marketplaceLots.id, lotId));
      
      result = { id: purchase.id, type: "item" };
    } else {
      throw new Error("Invalid purchase type");
    }

    return NextResponse.json({
      success: true, 
      type: result.type, 
      id: result.id,
      message: result.type === "game" ? "Game added" : "Item added",
    }, { headers: formatRateLimitHeaders(rl) });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "validation_failed", details: error.flatten() }, { status: 400 });
    }
    
    if (process.env.NODE_ENV === "development") {
      console.error("[purchase/verify] Unexpected error:", error);
    }
    
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: isProd ? "purchase_verification_failed" : (error as Error).message },
      { status: 500 }
    );
  }
}