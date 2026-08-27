// app/api/internal/game/admin-commands/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import {
    ADMIN_COMMAND_PROTOCOL,
    isExpiredAdminGameCommand,
    markAdminGameCommandsDelivered,
    readAdminGameCommands,
    removeAdminGameCommands,
} from "@/core/lib/adminGameCommands";
import { flushCommandsByIds, flushStaleCommands } from "@/core/lib/adminLiveSync";

const MAX_BATCH = 100;

function idList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_BATCH * 4);
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json().catch(() => ({}));
        const protocol = Number(body?.protocol) || 1;

        // A game server that still speaks the old drain-on-read protocol cannot
        // acknowledge anything, so handing it commands would drop them. It gets
        // nothing and the queue is drained to the database instead.
        if (protocol < ADMIN_COMMAND_PROTOCOL) {
            await flushStaleCommands(null);
            return NextResponse.json({ commands: [], protocol: ADMIN_COMMAND_PROTOCOL, upgradeRequired: true });
        }

        const acked = idList(body?.ack);
        if (acked.length > 0) await removeAdminGameCommands(acked);

        const skipped = idList(body?.skipped);
        if (skipped.length > 0) await flushCommandsByIds(skipped);

        if (Array.isArray(body?.onlineUserIds)) {
            await flushStaleCommands(idList(body.onlineUserIds));
        }

        if (body?.ackOnly === true) {
            return NextResponse.json({ commands: [], protocol: ADMIN_COMMAND_PROTOCOL });
        }

        const pending = await readAdminGameCommands();
        const expired = pending.filter((command) => isExpiredAdminGameCommand(command));
        if (expired.length > 0) await removeAdminGameCommands(expired.map((command) => command.id));

        const batch = pending.filter((command) => !isExpiredAdminGameCommand(command)).slice(0, MAX_BATCH);
        if (batch.length > 0) {
            await markAdminGameCommandsDelivered(batch.map((command) => command.id));
        }

        return NextResponse.json({ commands: batch, protocol: ADMIN_COMMAND_PROTOCOL });
    } catch (error) {
        console.error("[internal/admin-commands] Error:", error);
        return NextResponse.json({ error: "admin_commands_failed" }, { status: 500 });
    }
}
