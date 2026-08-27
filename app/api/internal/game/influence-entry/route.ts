// app/api/internal/game/influence-entry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameProgress, influenceEntries, users } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { verifyTnjTransfer, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { getInfluenceState } from "@/core/lib/influenceState";

const CURRENCIES = new Set(["ash", "tnj", "faction"]);

async function creditAsh(recipientWallet: string, gameId: string, amount: number): Promise<boolean> {
    const [recipient] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.wallet, recipientWallet))
        .limit(1);

    if (!recipient) return false;

    const [row] = await db
        .select({ data: gameProgress.data })
        .from(gameProgress)
        .where(and(eq(gameProgress.userId, recipient.id), eq(gameProgress.gameId, gameId)))
        .limit(1);

    if (!row) return false;

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(row.data || "{}") as Record<string, unknown>;
    } catch {
        parsed = {};
    }

    const current = Number(parsed.ash);
    parsed.ash = (Number.isFinite(current) ? current : 0) + amount;

    await db
        .update(gameProgress)
        .set({ data: JSON.stringify(parsed), updatedAt: new Date() })
        .where(and(eq(gameProgress.userId, recipient.id), eq(gameProgress.gameId, gameId)));

    return true;
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, currency, factionId, recipientWallet, tokenCa, tx, recipientOnline } = body;

        if (!userId || !gameId || !wallet || !CURRENCIES.has(currency)) {
            return NextResponse.json({ success: false, error: "missing_required_fields" }, { status: 400 });
        }

        const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
        if (amount <= 0) {
            return NextResponse.json({ success: false, error: "invalid_amount" }, { status: 400 });
        }

        const state = await getInfluenceState();

        if (state.feeCurrency !== currency || state.feeAmount !== amount) {
            return NextResponse.json({ success: false, error: "fee_changed" }, { status: 409 });
        }
        if (factionId && state.ownerFactionId !== factionId) {
            return NextResponse.json({ success: false, error: "owner_changed" }, { status: 409 });
        }

        let credited = false;

        if (currency === "ash") {
            if (recipientWallet && recipientOnline !== true) {
                credited = await creditAsh(recipientWallet, gameId, amount);
            }
        } else {
            if (typeof tx !== "string" || tx.length < 32) {
                return NextResponse.json({ success: false, error: "missing_signature" }, { status: 400 });
            }
            if (!recipientWallet) {
                return NextResponse.json({ success: false, error: "no_recipient" }, { status: 400 });
            }

            const reused = await findExistingSignatureUse(tx);
            if (reused) {
                return NextResponse.json({ success: false, error: "signature_reused" }, { status: 409 });
            }

            const mint = currency === "faction" ? (tokenCa || state.feeTokenCa) : undefined;
            if (currency === "faction" && !mint) {
                return NextResponse.json({ success: false, error: "no_token" }, { status: 400 });
            }

            const verdict = await verifyTnjTransfer({
                signature: tx,
                expectedAmountTnj: amount,
                expectedSigner: wallet,
                expectedRecipient: recipientWallet,
                mint: mint ?? undefined,
            });

            if (!verdict.ok) {
                return NextResponse.json(
                    { success: false, error: verdict.error, retryable: verdict.retryable === true },
                    { status: verdict.status }
                );
            }

            credited = true;
        }

        try {
            await db.insert(influenceEntries).values({
                gameId,
                userId,
                wallet,
                factionId: factionId || null,
                recipientWallet: recipientWallet || null,
                currency,
                amount: amount.toFixed(6),
                tx: typeof tx === "string" && tx.length >= 32 ? tx : null,
                credited,
            });
        } catch (insertError: unknown) {
            const code = (insertError as { code?: string })?.code;
            if (code === "23505") {
                return NextResponse.json({ success: false, error: "signature_reused" }, { status: 409 });
            }
            throw insertError;
        }

        return NextResponse.json({ success: true, credited, amount, currency });
    } catch (error) {
        console.error("[internal/influence-entry] Error:", error);
        return NextResponse.json({ success: false, error: "entry_failed" }, { status: 500 });
    }
}
