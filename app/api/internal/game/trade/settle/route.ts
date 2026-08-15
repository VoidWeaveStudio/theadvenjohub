// app/api/internal/game/trade/settle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { trades } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { verifyTnjTransfer, findExistingSignatureUse } from "@/core/lib/tnjPayment";


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
        const { tradeId, gameId, signature, sellerId, sellerWallet, buyerId, buyerWallet, itemId, itemName, quantity, priceTnj } = validation.data;

   
        const existingUse = await findExistingSignatureUse(signature);
        if (existingUse?.kind === "trade") {
            const existing = await db.query.trades.findFirst({ where: eq(trades.id, existingUse.id) });
            if (existing) {
                return NextResponse.json({
                    success: existing.status === "completed",
                    tradeId: existing.id,
                    error: existing.status === "completed" ? undefined : existing.failureReason,
                    alreadyProcessed: true,
                });
            }
        } else if (existingUse) {
            return NextResponse.json(
                { success: false, error: "signature_already_used" },
                { status: 409 }
            );
        }

        const verifyResult = await verifyTnjTransfer({
            signature,
            expectedAmountTnj: priceTnj,
            expectedSigner: buyerWallet,
            expectedRecipient: sellerWallet,
        });

        const baseRow = {
            gameId, sellerId, sellerWallet, buyerId, buyerWallet,
            itemId, itemName, quantity, priceTnj, txSignature: signature,
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
                    const existing = await db.query.trades.findFirst({ where: eq(trades.txSignature, signature) });
                    if (existing) {
                        return NextResponse.json({
                            success: existing.status === "completed",
                            tradeId: existing.id,
                            error: existing.status === "completed" ? undefined : existing.failureReason,
                            alreadyProcessed: true,
                        });
                    }
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
                    const existing = await db.query.trades.findFirst({ where: eq(trades.txSignature, signature) });
                    if (existing) {
                        return NextResponse.json({
                            success: existing.status === "completed",
                            tradeId: existing.id,
                            error: existing.status === "completed" ? undefined : existing.failureReason,
                            alreadyProcessed: true,
                        });
                    }
                }
                if (attempt === 1) {
                    console.error("[trade/settle] CRITICAL: payment verified on-chain but could not be recorded:", {
                        tradeId, signature, sellerWallet, buyerWallet, priceTnj, error: insertError?.message,
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
