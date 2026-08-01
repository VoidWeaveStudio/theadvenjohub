// app/api/internal/game/token-lookup-mail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { mailMessages } from "@/core/database/schema";
import { getTokenByCa } from "@/core/lib/dexscreener";
import { getOrCreateSystemUser } from "@/core/lib/systemMailSender";

function formatTokenMailBody(ca: string, token: NonNullable<Awaited<ReturnType<typeof getTokenByCa>>>): string {
    const lines = [
        `Name: ${token.name || "Unknown"} (${token.symbol || "?"})`,
        `Contract: ${ca}`,
        `Price: $${token.price || "0"}`,
        `Market Cap: $${token.mc || 0}`,
        `Liquidity: $${token.liquidity || 0}`,
        `24h Volume: $${token.volume?.h24 || 0}`,
        `24h Change: ${token.priceChange?.h24 || 0}%`,
        `DEX: ${token.dex || "unknown"}`,
        `Pair: ${token.pairAddress || "-"}`,
    ];

    return lines.join("\n");
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, ca } = body;

        if (!userId || typeof ca !== "string" || ca.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const trimmedCa = ca.trim().slice(0, 64);
        const token = await getTokenByCa(trimmedCa);

        if (!token) {
            return NextResponse.json({ error: "token_not_found" }, { status: 404 });
        }

        const systemUser = await getOrCreateSystemUser();
        if (!systemUser) {
            return NextResponse.json({ error: "system_user_unavailable" }, { status: 500 });
        }

        const [inserted] = await db.insert(mailMessages).values({
            senderUserId: systemUser.id,
            senderWallet: systemUser.wallet,
            recipientUserId: userId,
            subject: `Token Info: $${token.symbol || "?"}`,
            body: formatTokenMailBody(trimmedCa, token),
        }).returning();

        return NextResponse.json({ success: true, mailId: inserted.id });
    } catch (error) {
        console.error("[internal/token-lookup-mail] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
