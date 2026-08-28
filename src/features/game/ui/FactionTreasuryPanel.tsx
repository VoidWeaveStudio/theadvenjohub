// src/features/game/ui/FactionTreasuryPanel.tsx
"use client";

import { useEffect } from "react";
import { Coins, PawPrint, Shirt, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail, FactionLedgerEntry, FactionActiveBoost } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { FactionBoostsPanel } from "./FactionBoostsPanel";
import { FactionGrantPanel } from "./FactionGrantPanel";
import { BoostDuration } from "@/core/lib/factionBoosts";

interface FactionTreasuryPanelProps {
    faction: FactionDetail;
    myUserId: string;
    ledger: FactionLedgerEntry[];
    boosts: FactionActiveBoost[];
    onRequestLedger: (factionId: string) => void;
    onRequestBoosts: (factionId: string) => void;
    onBuyBoost: (factionId: string, boostId: string, duration: BoostDuration) => void;
    onGrantFragments: (
        factionId: string,
        targetUserId: string,
        companionFragments: number,
        cosmeticFragments: number
    ) => void;
}

const KIND_LABEL: Record<string, string> = {
    task: "g.treasury.kind.task",
    donation: "g.treasury.kind.donation",
    entry_toll: "g.treasury.kind.entryToll",
    boost: "g.treasury.kind.boost",
    grant: "g.treasury.kind.grant",
    turret: "g.treasury.kind.turret",
    war_stake: "g.treasury.kind.warStake",
    war_indemnity: "g.treasury.kind.warIndemnity",
    war_penalty: "g.treasury.kind.warPenalty",
    admin: "g.treasury.kind.admin",
};

function Pool({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
    return (
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex-shrink-0">{icon}</div>
            <div className="min-w-0">
                <div className="text-lg font-black text-[#E5E7EB]">{value.toLocaleString()}</div>
                <div className="text-[11px] text-[#8B8F98]">{label}</div>
            </div>
        </div>
    );
}

function amountCell(value: number, suffix: string) {
    if (value === 0) return null;
    const positive = value > 0;

    return (
        <span className={`inline-flex items-center gap-1 ${positive ? "text-[#59e07d]" : "text-[#ff8a8a]"}`}>
            {positive ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            {Math.abs(value).toLocaleString()} {suffix}
        </span>
    );
}

export function FactionTreasuryPanel({
    faction,
    myUserId,
    ledger,
    boosts,
    onRequestLedger,
    onRequestBoosts,
    onBuyBoost,
    onGrantFragments,
}: FactionTreasuryPanelProps) {
    const { t } = useLanguage();

    useEffect(() => {
        onRequestLedger(faction.id);
    }, [faction.id, onRequestLedger]);

    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Pool
                    icon={<Coins className="w-5 h-5 text-[#FFD166]" />}
                    value={faction.treasuryAsh ?? 0}
                    label={t("g.treasury.ash")}
                />
                <Pool
                    icon={<PawPrint className="w-5 h-5 text-[#6fd8ff]" />}
                    value={faction.treasuryCompanionFragments ?? 0}
                    label={t("g.treasury.companionFragments")}
                />
                <Pool
                    icon={<Shirt className="w-5 h-5 text-[#c79bff]" />}
                    value={faction.treasuryCosmeticFragments ?? 0}
                    label={t("g.treasury.cosmeticFragments")}
                />
            </div>

            <p className="text-xs text-[#8B8F98]">{t("g.treasury.hint")}</p>

            <FactionBoostsPanel
                faction={faction}
                myUserId={myUserId}
                boosts={boosts}
                onRequestBoosts={onRequestBoosts}
                onBuyBoost={onBuyBoost}
            />

            <FactionGrantPanel
                faction={faction}
                myUserId={myUserId}
                onGrantFragments={onGrantFragments}
            />

            <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-xs font-bold text-[#E5E7EB] border-b border-white/10">
                    {t("g.treasury.ledger")}
                </div>

                {ledger.length === 0 ? (
                    <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.treasury.ledgerEmpty")}</p>
                ) : (
                    <div className="divide-y divide-white/5">
                        {ledger.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#E5E7EB] truncate">
                                        {t(KIND_LABEL[entry.kind] ?? "g.treasury.kind.admin")}
                                        {entry.nickname ? ` · ${entry.nickname}` : ""}
                                    </div>
                                    <div className="text-[10px] text-[#6B7280]">
                                        {new Date(entry.createdAt).toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-0.5 text-[11px] font-bold flex-shrink-0">
                                    {amountCell(entry.ash, "ASH")}
                                    {amountCell(entry.companionFragments, t("g.treasury.shortCompanion"))}
                                    {amountCell(entry.cosmeticFragments, t("g.treasury.shortCosmetic"))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
