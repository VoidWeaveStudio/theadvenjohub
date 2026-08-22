// app/api/purchase/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import {
  gameLicenses,
  marketplacePurchases,
  marketplaceLots,
  games,
} from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { expectedAmountFor, resolveGamePrice } from "@/core/lib/gamePricing";

const verifySchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  gameId: z.string().uuid("Invalid gameId format").optional(),
  lotId: z.string().uuid("Invalid lotId format").optional(),
}).refine(data => data.gameId || data.lotId, {
  message: "Either gameId or lotId must be provided",
  path: ["gameId", "lotId"],
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

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

    const userRl = await checkRateLimit(`purchase:verify:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:purchase:verify:user",
    });

    if (!userRl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((userRl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(userRl) }
      );
    }

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

    const { signature, gameId, lotId } = validation.data;

    let serverPrice: number;
    // What the on-chain transfer is checked against. Equal to serverPrice for a
    // fixed price; slightly lower for a rate-derived one.
    let expectedAmountTnj: number;
    let lotStatus: string | null = null;

    if (gameId) {
      const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
      if (!game || !game.isActive) {
        return NextResponse.json(
          { error: "game_not_found" },
          { status: 404, headers: formatRateLimitHeaders(rl) }
        );
      }

      const ownedLicense = await db.query.gameLicenses.findFirst({
        where: and(
          eq(gameLicenses.userId, user.userId),
          eq(gameLicenses.gameId, gameId),
          eq(gameLicenses.isActive, true)
        ),
      });

      if (ownedLicense && ownedLicense.txSignature !== signature) {
        console.error("[purchase/verify] Payment submitted for an already owned game:", {
          gameId, signature, userId: user.userId, existingLicenseId: ownedLicense.id,
        });
        return NextResponse.json(
          {
            error: "already_owned",
            hint: "You already own this game. If TNJ was sent, contact support with your transaction signature.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      }

      const resolved = await resolveGamePrice(game);
      if (resolved.payableTnj === null || resolved.payableTnj <= 0) {
        return NextResponse.json(
          { error: "price_unavailable" },
          { status: 503, headers: formatRateLimitHeaders(rl) }
        );
      }

      serverPrice = resolved.payableTnj;
      // Fixed TNJ prices stay exact, as before. A USDT price gets the same slack
      // the shop allows, because the rate moves between quote and signature.
      expectedAmountTnj = expectedAmountFor(resolved) ?? resolved.payableTnj;
    } else {
      const lot = await db.query.marketplaceLots.findFirst({ where: eq(marketplaceLots.id, lotId!) });
      if (!lot) {
        return NextResponse.json(
          { error: "lot_not_found" },
          { status: 404, headers: formatRateLimitHeaders(rl) }
        );
      }
      serverPrice = lot.price;
      expectedAmountTnj = lot.price;
      lotStatus = lot.status;
    }

    // A tx signature must only ever redeem ONE purchase. gameLicenses,
    // marketplacePurchases, and factions (promo-code unlock) each enforce
    // their own uniqueness on their signature column, but those are separate
    // constraints on separate tables — without this cross-table check, the
    // same payment could be replayed once per table. (This still isn't fully
    // atomic against two truly concurrent requests racing each other; closing
    // that needs a single shared-signature table with one unique constraint.)
    const existingUse = await findExistingSignatureUse(signature);

    if (existingUse?.kind === "license" && gameId) {
      return NextResponse.json({ success: true, type: "game", id: existingUse.id, alreadyProcessed: true });
    }
    if (existingUse?.kind === "purchase" && lotId) {
      return NextResponse.json({ success: true, type: "item", id: existingUse.id, alreadyProcessed: true });
    }
    if (existingUse) {
      return NextResponse.json(
        {
          error: "signature_already_used",
          hint: "This transaction already redeemed a different purchase.",
        },
        { status: 409, headers: formatRateLimitHeaders(rl) }
      );
    }

    const verifyResult = await verifyTnjTransferToTreasury({
      signature,
      expectedAmountTnj,
      expectedSigner: user.wallet,
    });
    if (!verifyResult.ok) {
      return NextResponse.json(
        {
          error: verifyResult.error,
          ...(verifyResult.retryable ? { retryable: true } : {}),
          ...(verifyResult.details ? { details: verifyResult.details } : {}),
        },
        { status: verifyResult.status, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (lotId && lotStatus !== "available") {
      console.error("[purchase/verify] Paid transaction for a lot that is no longer available:", {
        lotId, signature, userId: user.userId, lotStatus,
      });

      try {
        await db.insert(marketplacePurchases).values({
          userId: user.userId,
          wallet: user.wallet,
          lotId,
          txSignature: signature,
          amount: serverPrice,
          status: "refund_pending",
        });
      } catch (recordError: any) {
        if (recordError?.code !== "23505") {
          console.error("[purchase/verify] Failed to record refund_pending purchase:", recordError?.message);
        }
      }

      return NextResponse.json(
        {
          error: "lot_already_sold",
          hint: "This item was already sold to someone else. Contact support with your transaction signature for a refund.",
        },
        { status: 409, headers: formatRateLimitHeaders(rl) }
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

      try {
        const [license] = await db.insert(gameLicenses).values({
          userId: user.userId,
          gameId,
          wallet: user.wallet,
          txSignature: signature,
          price: serverPrice,
          purchasedAt: new Date(),
          isActive: true,
        }).returning();

        result = { id: license.id, type: "game" };
      } catch (insertError: any) {
        if (insertError?.code !== "23505") throw insertError;

        const concurrent = await db.query.gameLicenses.findFirst({
          where: eq(gameLicenses.txSignature, signature),
        });
        if (concurrent) {
          return NextResponse.json({ success: true, type: "game", id: concurrent.id, alreadyProcessed: true });
        }

        const ownedConcurrently = await db.query.gameLicenses.findFirst({
          where: and(
            eq(gameLicenses.userId, user.userId),
            eq(gameLicenses.gameId, gameId),
            eq(gameLicenses.isActive, true)
          ),
        });
        if (!ownedConcurrently) throw insertError;

        console.error("[purchase/verify] Paid transaction for a game claimed by a concurrent request:", {
          gameId, signature, userId: user.userId, existingLicenseId: ownedConcurrently.id,
        });

        return NextResponse.json(
          {
            error: "already_owned",
            hint: "You already own this game. If TNJ was sent, contact support with your transaction signature.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      }

    } else if (lotId) {
      const raceCheck = await db.query.marketplacePurchases.findFirst({
        where: eq(marketplacePurchases.txSignature, signature),
      });
      if (raceCheck) {
        return NextResponse.json({ success: true, type: "item", id: raceCheck.id, alreadyProcessed: true });
      }

      const [claimedLot] = await db.update(marketplaceLots)
        .set({ status: "sold", updatedAt: new Date() })
        .where(and(eq(marketplaceLots.id, lotId), eq(marketplaceLots.status, "available")))
        .returning();

      if (!claimedLot) {
        console.error("[purchase/verify] Paid transaction could not claim lot (already sold):", {
          lotId, signature, userId: user.userId,
        });

        try {
          await db.insert(marketplacePurchases).values({
            userId: user.userId,
            wallet: user.wallet,
            lotId,
            txSignature: signature,
            amount: serverPrice,
            status: "refund_pending",
          });
        } catch (recordError: any) {
          if (recordError?.code !== "23505") {
            console.error("[purchase/verify] Failed to record refund_pending purchase:", recordError?.message);
          }
        }

        return NextResponse.json(
          {
            error: "lot_already_sold",
            hint: "This item was already sold to someone else. Contact support with your transaction signature for a refund.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      }

      try {
        const [purchase] = await db.insert(marketplacePurchases).values({
          userId: user.userId,
          wallet: user.wallet,
          lotId,
          txSignature: signature,
          amount: serverPrice,
          status: "confirmed",
        }).returning();

        result = { id: purchase.id, type: "item" };
      } catch (insertError: any) {
        if (insertError?.code !== "23505") throw insertError;

        const concurrent = await db.query.marketplacePurchases.findFirst({
          where: eq(marketplacePurchases.txSignature, signature),
        });
        if (!concurrent) throw insertError;

        return NextResponse.json({ success: true, type: "item", id: concurrent.id, alreadyProcessed: true });
      }
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
