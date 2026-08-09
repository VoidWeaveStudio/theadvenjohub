// src/core/lib/adminFaction.ts

export const ADMIN_FACTION_TOKEN_CA =
    process.env.ADMIN_FACTION_CA || "BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump";

export const ADMIN_FACTION_WALLET =
    process.env.ADMIN_WALLET || "FbHU2ZZW5rJWwXih3tTrMbt3hVMNHVjQLn4Yma9juadX";

export function isAdminFaction(founderWallet: string | null, tokenCa: string | null): boolean {
    if (tokenCa && tokenCa === ADMIN_FACTION_TOKEN_CA) return true;
    return !!founderWallet && founderWallet === ADMIN_FACTION_WALLET;
}
