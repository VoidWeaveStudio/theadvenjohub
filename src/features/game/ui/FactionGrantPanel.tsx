// src/features/game/ui/FactionGrantPanel.tsx
"use client";

import { useState } from "react";
import { Gift, PawPrint, Shirt } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail, FactionRosterEntry } from "../network/NetworkManager";
import { isFactionHead } from "@/core/lib/factionPermissions";

interface FactionGrantPanelProps {
    faction: FactionDetail;
    myUserId: string;
    onGrantFragments: (
        factionId: string,
        targetUserId: string,
        companionFragments: number,
        cosmeticFragments: number
    ) => void;
}

const STEPS = [5, 10, 25, 50];

function truncate(wallet: string): string {
    return wallet.length <= 10 ? wallet : `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function FactionGrantPanel({ faction, myUserId, onGrantFragments }: FactionGrantPanelProps) {
    const { t } = useLanguage();
    const [targetUserId, setTargetUserId] = useState<string | null>(null);
    const [companion, setCompanion] = useState(0);
    const [cosmetic, setCosmetic] = useState(0);

    const head = isFactionHead(
        { founderUserId: faction.founderUserId ?? "", verifiedCreatorUserId: faction.verifiedCreatorUserId ?? null },
        myUserId
    );
    if (!head) return null;

    const members = faction.roster.filter(
        (member): member is FactionRosterEntry & { userId: string } => typeof member.userId === "string"
    );

    const companionPool = faction.treasuryCompanionFragments ?? 0;
    const cosmeticPool = faction.treasuryCosmeticFragments ?? 0;
    const ready = !!targetUserId && (companion > 0 || cosmetic > 0) && companion <= companionPool && cosmetic <= cosmeticPool;

    const send = () => {
        if (!ready || !targetUserId) return;
        onGrantFragments(faction.id, targetUserId, companion, cosmetic);
        setCompanion(0);
        setCosmetic(0);
    };

    return (
        <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#c79bff]" />
                <span className="text-sm font-bold text-[#E5E7EB]">{t("g.grant.title")}</span>
            </div>

            <p className="text-[11px] text-[#8B8F98]">{t("g.grant.hint")}</p>

            {members.length === 0 ? (
                <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.grant.noMembers")}</p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                        {members.map((member) => (
                            <button
                                key={member.userId}
                                onClick={() => setTargetUserId(member.userId)}
                                className={`rounded px-2 py-1 text-[11px] font-bold border transition-colors ${targetUserId === member.userId
                                    ? "bg-[#c79bff]/15 border-[#c79bff]/40 text-[#E5E7EB]"
                                    : "bg-transparent border-white/10 text-[#8B8F98] hover:text-[#E5E7EB]"
                                    }`}
                            >
                                {member.nickname || truncate(member.wallet)}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        {([
                            { value: companion, set: setCompanion, pool: companionPool, icon: PawPrint, tint: "text-[#6fd8ff]", label: "g.treasury.companionFragments" },
                            { value: cosmetic, set: setCosmetic, pool: cosmeticPool, icon: Shirt, tint: "text-[#c79bff]", label: "g.treasury.cosmeticFragments" },
                        ] as const).map(({ value, set, pool, icon: Icon, tint, label }) => (
                            <div key={label} className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${tint}`} />
                                <span className="text-[11px] text-[#8B8F98] flex-1 min-w-0 truncate">
                                    {t(label)} · {pool.toLocaleString()}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {STEPS.map((step) => (
                                        <button
                                            key={step}
                                            disabled={step > pool}
                                            onClick={() => set(value === step ? 0 : step)}
                                            className={`rounded px-2 py-1 text-[10px] font-bold border transition-colors ${value === step
                                                ? "bg-white/15 border-white/30 text-[#E5E7EB]"
                                                : step > pool
                                                    ? "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                                                    : "bg-transparent border-white/10 text-[#8B8F98] hover:text-[#E5E7EB]"
                                                }`}
                                        >
                                            {step}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        disabled={!ready}
                        onClick={send}
                        className={`w-full rounded-lg py-2 text-xs font-bold border transition-colors ${ready
                            ? "bg-[#c79bff]/15 hover:bg-[#c79bff]/25 border-[#c79bff]/40 text-[#E5E7EB]"
                            : "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                            }`}
                    >
                        {t("g.grant.send")}
                    </button>
                </>
            )}
        </div>
    );
}
