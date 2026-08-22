// app/api/faction/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions, factionMembers, games, gameLicenses } from "@/core/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { claimSignature } from "@/core/lib/paymentLock";
import { getTokenByCa } from "@/core/lib/dexscreener";
import { getTokenBalance } from "@/core/blockchain";
import { getFactionRank } from "@/core/lib/factionRank";
import { loadPrice, payableTnjFor } from "@/core/lib/shopPricing";
import { TNJ_QUOTE_TOLERANCE } from "@/core/lib/tnjPricing";

const createSchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  ca: z.string().min(32).max(64),
  gameSlug: z.string().min(1).max(255),
});

function buildFactionDescription(name: string, symbol: string | null): string {
  return symbol ? `Community faction for ${name} ($${symbol}).` : `Community faction for ${name}.`;
}

function serializeFaction(faction: typeof factions.$inferSelect, rank: number | null) {
  return {
    id: faction.id,
    number: faction.number,
    name: faction.name,
    symbol: faction.symbol,
    image: faction.image,
    description: faction.description,
    tokenCa: faction.tokenCa,
    founderWallet: faction.founderWallet,
    memberCount: 1,
    rank,
    role: "founder" as const,
  };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:create:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:create",
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authResult.status, headers: formatRateLimitHeaders(rl) });
    }
    const { user } = authResult;

    const userRl = await checkRateLimit(`faction:create:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:create:user",
    });
    if (!userRl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((userRl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(userRl) }
      );
    }

    if (!verifyCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    const body = await req.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "validation_failed", details: validation.error.flatten() },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }
    const { signature, gameSlug } = validation.data;
    const trimmedCa = validation.data.ca.trim().slice(0, 64);

    const game = await db.query.games.findFirst({ where: eq(games.slug, gameSlug) });
    if (!game) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    const license = await db.query.gameLicenses.findFirst({
      where: and(
        eq(gameLicenses.userId, user.userId),
        eq(gameLicenses.gameId, game.id),
        eq(gameLicenses.isActive, true)
      ),
    });
    if (!license) {
      return NextResponse.json({ error: "no_license" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    if (!(await claimSignature(signature, `${user.userId}:faction-create`))) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409 });
    }

    const existingUse = await findExistingSignatureUse(signature);
    if (existingUse) {
      if (existingUse.kind === "faction_creation") {
        const fresh = await db.query.factions.findFirst({ where: eq(factions.id, existingUse.id) });
        if (fresh) {
          const rank = await getFactionRank(fresh.gameId, fresh.id);
          return NextResponse.json(
            { success: true, alreadyProcessed: true, faction: serializeFaction(fresh, rank) },
            { headers: formatRateLimitHeaders(rl) }
          );
        }
      }
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    const tokenInfo = await getTokenByCa(trimmedCa);
    if (!tokenInfo || !tokenInfo.name) {
      return NextResponse.json({ error: "token_not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    let caBalance: number;
    try {
      caBalance = await getTokenBalance(user.wallet, trimmedCa);
    } catch (err) {
      console.error("[faction/create] CA balance check failed:", err);
      return NextResponse.json({ error: "balance_check_failed" }, { status: 502, headers: formatRateLimitHeaders(rl) });
    }
    if (caBalance <= 0) {
      return NextResponse.json({ error: "insufficient_token_balance" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    const configuredPrice = await loadPrice(game.id, "faction_creation");
    const requiredTnj = configuredPrice ? await payableTnjFor(configuredPrice) : null;
    if (configuredPrice && configuredPrice.enabled === false) {
      return NextResponse.json({ error: "not_for_sale" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }
    if (requiredTnj === null) {
      return NextResponse.json({ error: "price_unavailable" }, { status: 503, headers: formatRateLimitHeaders(rl) });
    }

    const verifyResult = await verifyTnjTransferToTreasury({
      signature,
      expectedAmountTnj: Math.max(1, Math.floor(requiredTnj * (1 - TNJ_QUOTE_TOLERANCE))),
      expectedSigner: user.wallet,
    });
    if (!verifyResult.ok) {
      return NextResponse.json(
        { error: verifyResult.error, ...(verifyResult.details ? { details: verifyResult.details } : {}) },
        { status: verifyResult.status, headers: formatRateLimitHeaders(rl) }
      );
    }

    // Narrow the race window — re-check right before writing, same pattern as promo-code purchase.
    const raceCheck = await findExistingSignatureUse(signature);
    if (raceCheck) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    const trimmedName = String(tokenInfo.name).trim().slice(0, 50);
    if (trimmedName.length === 0) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400, headers: formatRateLimitHeaders(rl) });
    }
    const trimmedSymbol = tokenInfo.symbol ? String(tokenInfo.symbol).trim().slice(0, 20) || null : null;
    const trimmedImage = tokenInfo.image ? String(tokenInfo.image).trim().slice(0, 512) || null : null;
    const description = buildFactionDescription(trimmedName, trimmedSymbol);

    let created: typeof factions.$inferSelect;
    try {
      const [row] = await db.insert(factions).values({
        gameId: game.id,
        name: trimmedName,
        symbol: trimmedSymbol,
        image: trimmedImage,
        description,
        tokenCa: trimmedCa,
        founderUserId: user.userId,
        founderWallet: user.wallet,
        creationTx: signature,
      }).returning();
      created = row;
    } catch (insertError: any) {
      if (insertError?.code === "23505") {
        return NextResponse.json(
          {
            error: "name_taken",
            hint: "Payment received, but a faction for this token already exists. Contact support with your transaction signature.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      }
      throw insertError;
    }

    try {
      await db.insert(factionMembers).values({
        factionId: created.id,
        userId: user.userId,
        gameId: game.id,
        wallet: user.wallet,
        role: "founder",
        isDisplayed: sql`NOT EXISTS (SELECT 1 FROM faction_members WHERE user_id = ${user.userId} AND game_id = ${game.id})`,
      });
    } catch (membershipError: any) {
      if (membershipError?.code === "23505") {
        await db.insert(factionMembers).values({
          factionId: created.id,
          userId: user.userId,
          gameId: game.id,
          wallet: user.wallet,
          role: "founder",
          isDisplayed: false,
        }).catch((retryError) => {
          console.error("[faction/create] membership retry failed:", retryError);
        });
      } else {
        console.error("[faction/create] membership insert failed:", membershipError);
      }
    }

    const rank = await getFactionRank(game.id, created.id);

    return NextResponse.json(
      { success: true, faction: serializeFaction(created, rank) },
      { headers: formatRateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error("[faction/create] Error:", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
