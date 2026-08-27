// src/core/lib/adminProgress.ts
import { db } from "@/core/database";
import { gameProgress } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export interface ProgressBundle {
    id: string;
    gameId: string;
    data: Record<string, any>;
}

export async function readProgress(userId: string): Promise<ProgressBundle | null> {
    const row = await db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) });
    if (!row) return null;

    let data: Record<string, any> = {};
    if (row.data) {
        try {
            const parsed = JSON.parse(row.data);
            if (parsed && typeof parsed === "object") data = parsed;
        } catch {
            data = {};
        }
    }

    return { id: row.id, gameId: row.gameId, data };
}

export async function writeProgress(bundle: ProgressBundle): Promise<void> {
    await db
        .update(gameProgress)
        .set({ data: JSON.stringify(bundle.data), updatedAt: new Date() })
        .where(eq(gameProgress.id, bundle.id));
}

export function readPlaceables(bundle: ProgressBundle): Record<string, number> {
    const raw = bundle.data.placeables;
    return raw && typeof raw === "object" ? raw : {};
}
