// src/core/lib/roomLayoutBounds.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { CELL_SIZE } from "@/core/lib/roomLayoutGrid";

export const PERSONAL_PLOT_SIZE = 100;
export const FACTION_PLOT_SIZE = 500;
export const FACTION_MAX_EXTENT = 2000;

export interface CellBounds {
    min: number;
    max: number;
}

export function factionPlotExtent(level: number): number {
    if (level >= 20) return 2000;
    if (level >= 15) return 1500;
    if (level >= 10) return 1000;
    return FACTION_PLOT_SIZE;
}

export function cellBounds(plotSize: number, extent: number = plotSize): CellBounds {
    const across = Math.floor(plotSize / CELL_SIZE);
    const grow = Math.max(0, Math.floor((extent - plotSize) / 2 / CELL_SIZE));
    return { min: -grow, max: across - 1 + grow };
}

export async function factionPlotBounds(
    ownerType: "personal" | "faction",
    ownerId: string,
    claimedPlot: number
): Promise<CellBounds> {
    if (ownerType !== "faction") {
        return cellBounds(PERSONAL_PLOT_SIZE);
    }

    const faction = await db.query.factions.findFirst({ where: eq(factions.id, ownerId) });
    const extent = factionPlotExtent(faction?.level ?? 1);

    const frame = Math.min(Math.max(claimedPlot, 1), FACTION_PLOT_SIZE);
    return cellBounds(frame, extent);
}
