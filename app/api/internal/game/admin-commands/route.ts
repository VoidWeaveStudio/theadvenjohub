// app/api/internal/game/admin-commands/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { drainAdminGameCommands } from "@/core/lib/adminGameCommands";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const commands = await drainAdminGameCommands();
        return NextResponse.json({ commands });
    } catch (error) {
        console.error("[internal/admin-commands] Error:", error);
        return NextResponse.json({ error: "admin_commands_failed" }, { status: 500 });
    }
}
