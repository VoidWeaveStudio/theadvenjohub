// app/api/internal/game/influence-state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import {
    getInfluenceState,
    setInfluenceState,
    mergeInfluenceState,
    normalizeInfluenceState,
} from "@/core/lib/influenceState";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        if (body?.action === "set") {
            const state = await setInfluenceState(normalizeInfluenceState(body.state));
            return NextResponse.json({ state });
        }

        if (body?.action === "patch" && body.state && typeof body.state === "object") {
            const state = await mergeInfluenceState(body.state);
            return NextResponse.json({ state });
        }

        const state = await getInfluenceState();
        return NextResponse.json({ state });
    } catch (error) {
        console.error("[internal/influence-state] Error:", error);
        return NextResponse.json({ error: "influence_state_failed" }, { status: 500 });
    }
}
