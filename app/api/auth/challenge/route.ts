//app\api\auth\challenge\route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const NONCE_STORE = new Map<string, { nonce: string; expires: number }>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 минут

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of NONCE_STORE.entries()) {
        if (now > value.expires) NONCE_STORE.delete(key);
    }
}, 5 * 60 * 1000);

export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get("wallet");

    if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        return NextResponse.json(
            { error: "invalid_wallet" },
            { status: 400 }
        );
    }

    const rl = await checkRateLimit(`auth:challenge:${wallet}`, {
        maxAttempts: 10,
        windowMs: 60_000,
        prefix: "api:auth:challenge",
    });

    if (!rl.allowed) {
        return NextResponse.json(
            { error: "too_many_attempts" },
            {
                status: 429,
                headers: formatRateLimitHeaders(rl),
            }
        );
    }

    const nonce = randomBytes(16).toString("hex");
    const expires = Date.now() + NONCE_TTL_MS;

    NONCE_STORE.set(wallet, { nonce, expires });

    return NextResponse.json(
        { nonce },
        {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
                ...formatRateLimitHeaders(rl),
            },
        }
    );
}