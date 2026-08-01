// src/core/admin/verifyAdminAction.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCSRF } from "@/core/auth/lib/csrf";
import { verifySolanaSignature } from "@/core/auth/lib/signMessage";
import { buildAdminActionMessage } from "@/core/admin/adminActionMessage";

const MAX_ACTION_AGE_MS = 60_000;

export function verifyAdminAction(req: NextRequest, body: any, action: string, target: string): NextResponse | null {
    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "invalid_csrf_token" }, { status: 403 });
    }

    const { wallet, signature, timestamp } = body;
    if (typeof wallet !== "string" || typeof signature !== "string" || typeof timestamp !== "number") {
        return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet || wallet !== adminWallet) {
        return NextResponse.json({ error: "not_admin" }, { status: 403 });
    }

    if (Math.abs(Date.now() - timestamp) > MAX_ACTION_AGE_MS) {
        return NextResponse.json({ error: "signature_expired" }, { status: 401 });
    }

    const message = buildAdminActionMessage(action, target, timestamp);
    if (!verifySolanaSignature(signature, message, wallet)) {
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    return null;
}
