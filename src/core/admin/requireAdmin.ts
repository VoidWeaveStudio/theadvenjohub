// src/core/admin/requireAdmin.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, AdminPayload } from "@/core/admin/auth";

export function requireAdmin(req: NextRequest): AdminPayload | NextResponse {
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = req.cookies.get("admin_token")?.value;
    const token = bearerToken || cookieToken;

    if (!token) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = verifyAdminToken(token);
    if (!admin) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return admin;
}
