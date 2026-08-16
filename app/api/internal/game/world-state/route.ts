// app/api/internal/game/world-state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { getWorldState, setWorldState, mergeWorldState, normalizeWorldState } from "@/core/lib/worldState";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        if (body?.action === "set") {
            const state = await setWorldState(normalizeWorldState(body.state));
            return NextResponse.json({ state });
        }

        if (body?.action === "patch" && body.state && typeof body.state === "object") {
            const state = await mergeWorldState(body.state);
            return NextResponse.json({ state });
        }

        const state = await getWorldState();
        return NextResponse.json({ state });
    } catch (error) {
        console.error("[internal/world-state] Error:", error);
        return NextResponse.json({ error: "world_state_failed" }, { status: 500 });
    }
}
