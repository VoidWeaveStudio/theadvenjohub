//src\core\lib\internalAuth.ts
import { NextRequest, NextResponse } from "next/server";

export function verifyInternalRequest(req: NextRequest): boolean {
    const secret = req.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret) {
        console.error("[InternalAuth] INTERNAL_API_SECRET not configured");
        return false;
    }

    if (!secret || secret !== expectedSecret) {
        return false;
    }

    return true;
}

export function unauthorizedResponse(): NextResponse {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}