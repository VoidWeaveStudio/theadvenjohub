// app/api/admin/factions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factions, factionMembers, games, users } from "@/core/database/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { getTokenByCa } from "@/core/lib/dexscreener";

const ADMIN_FACTION_GAME_SLUG = "tanjo-shooter";

function buildFactionDescription(name: string, symbol: string | null): string {
    return symbol ? `Community faction for ${name} ($${symbol}).` : `Community faction for ${name}.`;
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();

        const memberCountSubquery = db
            .select({ count: sql<number>`count(*)` })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, factions.id));

        const rows = await db
            .select({
                id: factions.id,
                number: factions.number,
                name: factions.name,
                symbol: factions.symbol,
                image: factions.image,
                tokenCa: factions.tokenCa,
                founderWallet: factions.founderWallet,
                level: factions.level,
                levelProgressAsh: factions.levelProgressAsh,
                createdAt: factions.createdAt,
                memberCount: sql<number>`(${memberCountSubquery})`,
            })
            .from(factions)
            .where(query ? or(ilike(factions.name, `%${query}%`), eq(factions.tokenCa, query)) : undefined)
            .orderBy(desc(factions.level), desc(factions.createdAt))
            .limit(200);

        return NextResponse.json({ factions: rows });
    } catch (error) {
        console.error("[admin/factions] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const { ca, name: nameOverride, symbol: symbolOverride, image: imageOverride } = body;

        if (typeof ca !== "string" || ca.trim().length < 32) {
            return NextResponse.json({ error: "invalid_ca" }, { status: 400 });
        }
        const trimmedCa = ca.trim().slice(0, 64);

        const sigError = verifyAdminAction(req, body, "createFaction", trimmedCa);
        if (sigError) return sigError;

        const existing = await db.query.factions.findFirst({ where: eq(factions.tokenCa, trimmedCa) });
        if (existing) {
            return NextResponse.json({ error: "already_exists", faction: { id: existing.id, name: existing.name } }, { status: 409 });
        }

        let trimmedName = typeof nameOverride === "string" ? nameOverride.trim().slice(0, 50) : "";
        let trimmedSymbol = typeof symbolOverride === "string" && symbolOverride.trim().length > 0 ? symbolOverride.trim().slice(0, 20) : null;
        let trimmedImage = typeof imageOverride === "string" && imageOverride.trim().length > 0 ? imageOverride.trim().slice(0, 512) : null;

        if (!trimmedName) {
            const tokenInfo = await getTokenByCa(trimmedCa);
            if (tokenInfo?.name) {
                trimmedName = String(tokenInfo.name).trim().slice(0, 50);
                if (!trimmedSymbol && tokenInfo.symbol) trimmedSymbol = String(tokenInfo.symbol).trim().slice(0, 20);
                if (!trimmedImage && tokenInfo.image) trimmedImage = String(tokenInfo.image).trim().slice(0, 512);
            }
        }

        if (!trimmedName) {
            return NextResponse.json({ error: "name_required", hint: "Token not found automatically, provide a name manually." }, { status: 400 });
        }

        const game = await db.query.games.findFirst({ where: eq(games.slug, ADMIN_FACTION_GAME_SLUG) });
        if (!game) {
            return NextResponse.json({ error: "game_not_found" }, { status: 500 });
        }

        const adminWallet = process.env.ADMIN_WALLET;
        if (!adminWallet) {
            return NextResponse.json({ error: "server_config_error" }, { status: 500 });
        }

        const [founder] = await db
            .insert(users)
            .values({ wallet: adminWallet, createdAt: new Date() })
            .onConflictDoNothing({ target: users.wallet })
            .returning();
        const founderUser = founder ?? await db.query.users.findFirst({ where: eq(users.wallet, adminWallet) });
        if (!founderUser) {
            return NextResponse.json({ error: "founder_setup_failed" }, { status: 500 });
        }

        let created;
        try {
            [created] = await db.insert(factions).values({
                gameId: game.id,
                name: trimmedName,
                symbol: trimmedSymbol,
                image: trimmedImage,
                description: buildFactionDescription(trimmedName, trimmedSymbol),
                tokenCa: trimmedCa,
                founderUserId: founderUser.id,
                founderWallet: founderUser.wallet,
            }).returning();
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "name_taken" }, { status: 409 });
            }
            throw insertError;
        }

        return NextResponse.json({ success: true, faction: created });
    } catch (error) {
        console.error("[admin/factions POST] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
