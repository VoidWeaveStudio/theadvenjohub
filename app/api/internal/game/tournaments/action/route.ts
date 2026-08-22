// app/api/internal/game/tournaments/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { isTournamentKind } from "@/core/lib/tournaments";
import {
    joinTournament,
    likeEntry,
    listTournaments,
    setEntryPost,
    submitShot,
    submitSkin,
    type TournamentActionResult,
} from "@/core/lib/tournamentStore";

// One endpoint for the four player-driven mutations. Each of them ends the same
// way — the caller wants the refreshed board back — so splitting them into four
// routes would only duplicate that tail.
export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { action, gameId, userId, tournamentId } = body;

        if (!gameId || !userId || typeof tournamentId !== "string" || tournamentId.length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        let result: TournamentActionResult<unknown>;

        switch (action) {
            case "join":
                result = await joinTournament(tournamentId, userId);
                break;
            case "submitSkin":
                result = isTournamentKind(body.kind)
                    ? await submitSkin(tournamentId, userId, body.kind)
                    : { ok: false, error: "wrong_kind" };
                break;
            case "submitShot":
                result = await submitShot(tournamentId, userId, body.shotUrl);
                break;
            case "setPost":
                result = await setEntryPost(tournamentId, userId, body.postUrl);
                break;
            case "like":
                result = await likeEntry(tournamentId, userId, body.entryId);
                break;
            default:
                return NextResponse.json({ error: "unknown_action" }, { status: 400 });
        }

        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error });
        }

        return NextResponse.json({
            success: true,
            result: result.value,
            tournaments: await listTournaments(gameId, userId),
        });
    } catch (error) {
        console.error("[internal/tournaments/action] Error:", error);
        return NextResponse.json({ error: "action_failed" }, { status: 500 });
    }
}
