// src/core/lib/factionMembership.ts
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { getTokenBalance } from "@/core/blockchain";

export type JoinFactionResult =
  | { ok: true; faction: typeof factions.$inferSelect; alreadyMember: boolean }
  | { ok: false; error: "faction_not_found" | "balance_check_failed" | "insufficient_token_balance"; status: number };

// Extracted from app/api/internal/game/faction/join/route.ts so promo-code
// redemption (which happens directly from the website, before the player is
// even in-game — the internal/* routes are meant for server-to-server calls
// from game-server, gated by X-Internal-Secret) can join a faction without an
// HTTP self-call. Logic is unchanged, including:
// - fail-closed on RPC balance-check errors (unlike verify-memberships, which
//   fail-opens since that path only ever removes access, never grants it).
// - the two-step insert retry: the first insert's isDisplayed subquery can
//   race with a concurrent join for the SAME user into a DIFFERENT faction
//   (both evaluating "no displayed faction yet" before either commits),
//   tripping the partial unique index on isDisplayed=true rather than the
//   (userId, factionId) one — retrying with isDisplayed:false resolves that
//   race safely. Only a 23505 on the retry means "already a member of this
//   exact faction".
export async function joinFactionForUser(params: {
  userId: string;
  gameId: string;
  wallet: string;
  factionId: string;
}): Promise<JoinFactionResult> {
  const { userId, gameId, wallet, factionId } = params;

  const faction = await db.query.factions.findFirst({
    where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
  });
  if (!faction) {
    return { ok: false, error: "faction_not_found", status: 404 };
  }

  if (faction.tokenCa) {
    let balance: number;
    try {
      balance = await getTokenBalance(wallet, faction.tokenCa);
    } catch (err) {
      console.error("[factionMembership] balance check failed:", err);
      return { ok: false, error: "balance_check_failed", status: 502 };
    }
    if (balance <= 0) {
      return { ok: false, error: "insufficient_token_balance", status: 403 };
    }
  }

  let alreadyMember = false;
  try {
    await db.insert(factionMembers).values({
      factionId,
      userId,
      gameId,
      wallet,
      role: "member",
      isDisplayed: sql`NOT EXISTS (SELECT 1 FROM faction_members WHERE user_id = ${userId} AND game_id = ${gameId})`,
    });
  } catch (insertError: any) {
    if (insertError?.code === "23505") {
      try {
        await db.insert(factionMembers).values({
          factionId, userId, gameId, wallet, role: "member", isDisplayed: false,
        });
      } catch (retryError: any) {
        if (retryError?.code === "23505") {
          alreadyMember = true;
        } else {
          throw retryError;
        }
      }
    } else if (insertError?.code === "23503") {
      return { ok: false, error: "faction_not_found", status: 404 };
    } else {
      throw insertError;
    }
  }

  return { ok: true, faction, alreadyMember };
}
