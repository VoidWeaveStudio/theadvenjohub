// app/api/internal/game/trade/settle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { trades } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { verifyTnjTransfer, findExistingSignatureUse, TnjPaymentVerifyResult } from "@/core/lib/tnjPayment";


const settleSchema = z.object({
    tradeId: z.string().min(1),
    gameId: z.string().uuid(),
    signature: z.string().min(80).max(100),
    sellerId: z.string().uuid(),
    sellerWallet: z.string().min(32).max(44),
    buyerId: z.string().uuid(),
    buyerWallet: z.string().min(32).max(44),
    itemId: z.string().min(1).max(50),
    itemName: z.string().min(1).max(100),
    quantity: z.number().int().positive().default(1),
    priceTnj: z.number().int().positive(),
});

type Deal = z.infer<typeof settleSchema>;
type TradeRow = typeof trades.$inferSelect;

// A signature pays for exactly the deal it was recorded against. Every path that
// answers from an existing row goes through this check first: without it, a buyer
// could replay the signature of one completed trade in every later trade and be
// handed the item each time for a single payment.
function isSameDeal(row: TradeRow, deal: Deal): boolean {
    return (
        row.gameId === deal.gameId &&
        row.sellerId === deal.sellerId &&
        row.buyerId === deal.buyerId &&
        row.itemId === deal.itemId &&
        row.quantity === deal.quantity &&
        row.priceTnj === deal.priceTnj
    );
}

function signatureTaken() {
    return NextResponse.json({ success: false, error: "signature_already_used" }, { status: 409 });
}

function verifyPayment(deal: Deal): Promise<TnjPaymentVerifyResult> {
    return verifyTnjTransfer({
        signature: deal.signature,
        expectedAmountTnj: deal.priceTnj,
        expectedSigner: deal.buyerWallet,
        expectedRecipient: deal.sellerWallet,
    });
}

// Answers a settle request that found the signature already recorded. A row for
// another deal is refused; a completed row for this deal is idempotent; a failed
// row is re-verified, because verification can come back negative on an RPC
// answer that omits the balances for a payment that did land, and writing that
// off would leave the buyer paid with no item and no way to retry.
async function respondForExistingTrade(row: TradeRow, deal: Deal): Promise<NextResponse> {
    if (!isSameDeal(row, deal)) return signatureTaken();

    if (row.status === "completed") {
        return NextResponse.json({ success: true, tradeId: row.id, alreadyProcessed: true });
    }

    const recheck = await verifyPayment(deal);

    if (!recheck.ok) {
        return NextResponse.json(
            {
                success: false,
                tradeId: row.id,
                error: recheck.error,
                ...(recheck.retryable ? { retryable: true } : {}),
                alreadyProcessed: true,
            },
            { status: recheck.retryable ? 503 : recheck.status }
        );
    }

    await db
        .update(trades)
        .set({ status: "completed", failureReason: null })
        .where(and(eq(trades.id, row.id), eq(trades.status, "failed")));

    console.warn("[trade/settle] recovered a trade previously recorded as failed:", {
        tradeId: row.id, signature: deal.signature, previousReason: row.failureReason,
    });

    return NextResponse.json({ success: true, tradeId: row.id, recovered: true });
}

async function respondForConflict(deal: Deal): Promise<NextResponse | null> {
    const row = await db.query.trades.findFirst({ where: eq(trades.txSignature, deal.signature) });
    if (!row) return null;
    return respondForExistingTrade(row, deal);
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const validation = settleSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "validation_failed", details: validation.error.flatten() },
                { status: 400 }
            );
        }
        const deal = validation.data;

        const existingUse = await findExistingSignatureUse(deal.signature);
        if (existingUse?.kind === "trade") {
            const existing = await db.query.trades.findFirst({ where: eq(trades.id, existingUse.id) });
            if (existing) return respondForExistingTrade(existing, deal);
        } else if (existingUse) {
            return signatureTaken();
        }

        const verifyResult = await verifyPayment(deal);

        const baseRow = {
            gameId: deal.gameId,
            sellerId: deal.sellerId,
            sellerWallet: deal.sellerWallet,
            buyerId: deal.buyerId,
            buyerWallet: deal.buyerWallet,
            itemId: deal.itemId,
            itemName: deal.itemName,
            quantity: deal.quantity,
            priceTnj: deal.priceTnj,
            txSignature: deal.signature,
        };

        if (!verifyResult.ok && verifyResult.retryable) {
            return NextResponse.json(
                { success: false, error: verifyResult.error, retryable: true },
                { status: 503 }
            );
        }

        if (!verifyResult.ok) {
            try {
                const [row] = await db.insert(trades).values({
                    ...baseRow,
                    status: "failed",
                    failureReason: verifyResult.error,
                }).returning();
                return NextResponse.json(
                    { success: false, error: verifyResult.error, tradeId: row.id },
                    { status: verifyResult.status }
                );
            } catch (insertError: any) {
                if (insertError?.code === "23505") {
                    const conflict = await respondForConflict(deal);
                    if (conflict) return conflict;
                }
                throw insertError;
            }
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const [row] = await db.insert(trades).values({
                    ...baseRow,
                    status: "completed",
                }).returning();
                return NextResponse.json({ success: true, tradeId: row.id });
            } catch (insertError: any) {
                if (insertError?.code === "23505") {
                    const conflict = await respondForConflict(deal);
                    if (conflict) return conflict;
                }
                if (attempt === 1) {
                    console.error("[trade/settle] CRITICAL: payment verified on-chain but could not be recorded:", {
                        tradeId: deal.tradeId,
                        signature: deal.signature,
                        sellerWallet: deal.sellerWallet,
                        buyerWallet: deal.buyerWallet,
                        priceTnj: deal.priceTnj,
                        error: insertError?.message,
                    });
                    return NextResponse.json(
                        { success: false, error: "settlement_record_failed", hint: "Payment confirmed on-chain but recording failed. Contact support with your transaction signature." },
                        { status: 500 }
                    );
                }
            }
        }

        return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
    } catch (error) {
        console.error("[trade/settle] Unexpected error:", error);
        return NextResponse.json({ success: false, error: "settle_failed" }, { status: 500 });
    }
}
