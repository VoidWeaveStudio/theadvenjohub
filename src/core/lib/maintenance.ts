// src/core/lib/maintenance.ts
import { db } from "@/core/database";
import { appSettings } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const MODE_KEY = "maintenance_mode";
const MESSAGE_KEY = "maintenance_message";

export async function getMaintenanceStatus(): Promise<{ enabled: boolean; message: string }> {
    const rows = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, MODE_KEY));

    const modeRow = rows[0];
    const enabled = modeRow?.value === "true";

    if (!enabled) return { enabled: false, message: "" };

    const messageRows = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, MESSAGE_KEY));

    return {
        enabled: true,
        message: messageRows[0]?.value || "The game is currently down for maintenance. Please check back later.",
    };
}

export async function setMaintenanceStatus(enabled: boolean, message?: string): Promise<void> {
    await db
        .insert(appSettings)
        .values({ key: MODE_KEY, value: enabled ? "true" : "false", updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: enabled ? "true" : "false", updatedAt: new Date() } });

    if (message !== undefined) {
        await db
            .insert(appSettings)
            .values({ key: MESSAGE_KEY, value: message, updatedAt: new Date() })
            .onConflictDoUpdate({ target: appSettings.key, set: { value: message, updatedAt: new Date() } });
    }
}
