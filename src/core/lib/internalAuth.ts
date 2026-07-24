//src\core\lib\internalAuth.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function verifyInternalRequest(req: NextRequest): boolean {
    const secret = req.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret) {
        console.error("[InternalAuth] INTERNAL_API_SECRET not configured");
        return false;
    }

    if (!secret) {
        return false;
    }

    const a = Buffer.from(secret);
    const b = Buffer.from(expectedSecret);
    if (a.length !== b.length) {
        return false;
    }

    return timingSafeEqual(a, b);
}

export function unauthorizedResponse(): NextResponse {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}