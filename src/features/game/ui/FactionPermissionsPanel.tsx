// src/features/game/ui/FactionPermissionsPanel.tsx
"use client";

import { useState } from "react";
import { ShieldCheck, Coins, ClipboardList, Swords, Gavel } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail, FactionRosterEntry } from "../network/NetworkManager";
import {
    FACTION_PERM_TREASURY,
    FACTION_PERM_TASKS,
    FACTION_PERM_WAR,
    FACTION_PERM_MODERATION,
} from "@/core/lib/factionPermissions";

interface FactionPermissionsPanelProps {
    faction: FactionDetail;
    myUserId: string;
    onSetPermissions: (targetUserId: string, permissions: number, roleTitle: string | null) => void;
}

const BITS = [
    { bit: FACTION_PERM_TREASURY, key: "g.perm.treasury", icon: Coins, tint: "text-[#FFD166]" },
    { bit: FACTION_PERM_TASKS, key: "g.perm.tasks", icon: ClipboardList, tint: "text-[#6fd8ff]" },
    { bit: FACTION_PERM_WAR, key: "g.perm.war", icon: Swords, tint: "text-[#ff5a48]" },
    { bit: FACTION_PERM_MODERATION, key: "g.perm.moderation", icon: Gavel, tint: "text-[#c79bff]" },
];

function truncate(wallet: string): string {
    return wallet.length <= 10 ? wallet : `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function FactionPermissionsPanel({ faction, myUserId, onSetPermissions }: FactionPermissionsPanelProps) {
    const { t } = useLanguage();
    const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});

    const headUserId = faction.verifiedCreatorUserId ?? faction.founderUserId ?? null;
    const isHead = !!headUserId && headUserId === myUserId;

    if (!isHead) return null;

    const editable = faction.roster.filter(
        (member): member is FactionRosterEntry & { userId: string } =>
            typeof member.userId === "string" && member.userId !== headUserId
    );

    return (
        <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#59e07d]" />
                <span className="text-sm font-bold text-[#E5E7EB]">{t("g.perm.title")}</span>
            </div>

            <p className="text-[11px] text-[#8B8F98]">{t("g.perm.hint")}</p>

            {editable.length === 0 ? (
                <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.perm.noMembers")}</p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {editable.map((member) => {
                        const permissions = member.permissions ?? 0;
                        const draft = titleDrafts[member.userId] ?? member.roleTitle ?? "";

                        return (
                            <div key={member.userId} className="bg-black/25 border border-white/5 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-[#E5E7EB] truncate">
                                        {member.nickname || truncate(member.wallet)}
                                    </span>
                                    <span className="text-[10px] text-[#6B7280] flex-shrink-0">
                                        {member.contributionPoints.toLocaleString()} pts
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1">
                                    {BITS.map(({ bit, key, icon: Icon, tint }) => {
                                        const on = (permissions & bit) === bit;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => onSetPermissions(
                                                    member.userId,
                                                    on ? permissions & ~bit : permissions | bit,
                                                    member.roleTitle ?? null
                                                )}
                                                className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-bold border transition-colors ${on
                                                    ? "bg-white/10 border-white/25 text-[#E5E7EB]"
                                                    : "bg-transparent border-white/10 text-[#6B7280] hover:text-[#9aa0ad]"
                                                    }`}
                                            >
                                                <Icon className={`w-3 h-3 flex-shrink-0 ${on ? tint : ""}`} />
                                                <span className="truncate">{t(key)}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={draft}
                                        maxLength={24}
                                        placeholder={t("g.perm.titlePlaceholder")}
                                        onChange={(e) => setTitleDrafts((prev) => ({ ...prev, [member.userId]: e.target.value }))}
                                        className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] text-[#E5E7EB] outline-none focus:border-[#59e07d]/40"
                                    />
                                    <button
                                        onClick={() => onSetPermissions(member.userId, permissions, draft.trim() || null)}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2.5 py-1 text-[11px] font-bold text-[#E5E7EB] transition-colors flex-shrink-0"
                                    >
                                        {t("g.perm.saveTitle")}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
