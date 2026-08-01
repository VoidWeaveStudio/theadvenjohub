// src/core/lib/systemMailSender.ts
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export const SYSTEM_WALLET = "SYSTEM11111111111111111111111111111111111";

export async function getOrCreateSystemUser() {
    const [inserted] = await db
        .insert(users)
        .values({ wallet: SYSTEM_WALLET, createdAt: new Date() })
        .onConflictDoNothing({ target: users.wallet })
        .returning();

    return inserted || await db.query.users.findFirst({ where: eq(users.wallet, SYSTEM_WALLET) });
}
