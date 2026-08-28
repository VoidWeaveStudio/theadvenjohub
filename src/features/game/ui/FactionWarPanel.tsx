// src/features/game/ui/FactionWarPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Swords, Heart, Flag, HandCoins, Search } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail, FactionSummary, FactionWarSummary } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { isFactionHead, hasFactionPermission, FACTION_PERM_WAR } from "@/core/lib/factionPermissions";
import {
    WAR_MIN_LEVEL,
    WAR_STAKE_ASH,
    WAR_INDEMNITY_ASH,
    WAR_WITHDRAWAL_MULT,
    isDeclarer,
} from "@/core/lib/factionWar";

interface FactionWarPanelProps {
    faction: FactionDetail;
    myUserId: string;
    wars: FactionWarSummary[];
    searchResults: FactionSummary[];
    onRequestWars: () => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onDeclareWar: (factionId: string, targetFactionId: string) => void;
    onCapitulate: (factionId: string, warId: string) => void;
    onSettle: (factionId: string, warId: string) => void;
}

function HeartBar({ label, hp, maxHp, tint }: { label: string; hp: number; maxHp: number; tint: string }) {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-[#E5E7EB] truncate">{label}</span>
                <span className="text-[#8B8F98] flex-shrink-0">
                    {Math.round(hp).toLocaleString()} / {maxHp.toLocaleString()}
                </span>
            </div>
            <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${ratio * 100}%`, backgroundColor: tint }}
                />
            </div>
        </div>
    );
}

export function FactionWarPanel({
    faction,
    myUserId,
    wars,
    searchResults,
    onRequestWars,
    onSearchFactions,
    onDeclareWar,
    onCapitulate,
    onSettle,
}: FactionWarPanelProps) {
    const { t } = useLanguage();
    const [query, setQuery] = useState("");
    const [confirming, setConfirming] = useState<string | null>(null);

    useEffect(() => {
        onRequestWars();
    }, [onRequestWars]);

    const me = faction.roster.find((member) => member.userId === myUserId);
    const head = { founderUserId: faction.founderUserId ?? "", verifiedCreatorUserId: faction.verifiedCreatorUserId ?? null };
    const canDeclare = hasFactionPermission(head, myUserId, me?.permissions ?? 0, FACTION_PERM_WAR);
    const isHead = isFactionHead(head, myUserId);

    const war = wars.find(
        (entry) => entry.declarerFactionId === faction.id || entry.defenderFactionId === faction.id
    ) ?? null;

    if (war) {
        const weDeclared = isDeclarer(war, faction.id);
        const exitPrice = weDeclared ? Math.round(WAR_INDEMNITY_ASH * WAR_WITHDRAWAL_MULT) : WAR_INDEMNITY_ASH;
        const ash = faction.treasuryAsh ?? 0;

        return (
            <div className="space-y-4">
                <FactionHeader faction={faction} />

                <div className="bg-[#ff5a48]/8 border border-[#ff5a48]/30 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <Swords className="w-4 h-4 text-[#ff5a48]" />
                        <span className="text-sm font-bold text-[#E5E7EB]">{t("g.war.active")}</span>
                    </div>

                    <p className="text-[11px] text-[#8B8F98]">
                        {weDeclared ? t("g.war.youDeclared") : t("g.war.youWereAttacked")}
                    </p>

                    <div className="space-y-2">
                        <HeartBar
                            label={war.declarerName ?? t("g.war.declarer")}
                            hp={war.declarerHeartHp}
                            maxHp={war.heartMaxHp}
                            tint={weDeclared ? "#59e07d" : "#ff5a48"}
                        />
                        <HeartBar
                            label={war.defenderName ?? t("g.war.defender")}
                            hp={war.defenderHeartHp}
                            maxHp={war.heartMaxHp}
                            tint={weDeclared ? "#ff5a48" : "#59e07d"}
                        />
                    </div>

                    <p className="text-[11px] text-[#8B8F98] flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-[#ff5a48] flex-shrink-0" />
                        {t("g.war.heartHint")}
                    </p>
                </div>

                {isHead && (
                    <div className="space-y-2">
                        <button
                            disabled={ash < exitPrice}
                            onClick={() => onSettle(faction.id, war.id)}
                            className={`w-full rounded-lg py-2 text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${ash >= exitPrice
                                ? "bg-white/5 hover:bg-white/10 border-white/15 text-[#E5E7EB]"
                                : "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                                }`}
                        >
                            <HandCoins className="w-3.5 h-3.5" />
                            {t("g.war.settle", { n: exitPrice.toLocaleString() })}
                        </button>

                        <button
                            onClick={() => (confirming === war.id ? onCapitulate(faction.id, war.id) : setConfirming(war.id))}
                            className="w-full rounded-lg py-2 text-xs font-bold border border-[#ff5a48]/30 bg-[#ff5a48]/10 hover:bg-[#ff5a48]/20 text-[#ff8a8a] transition-colors flex items-center justify-center gap-2"
                        >
                            <Flag className="w-3.5 h-3.5" />
                            {confirming === war.id ? t("g.war.capitulateConfirm") : t("g.war.capitulate")}
                        </button>

                        <p className="text-[10px] text-[#8B8F98] text-center">
                            {weDeclared ? t("g.war.withdrawalPenalty") : t("g.war.exitHint")}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    const targets = searchResults.filter((entry) => entry.id !== faction.id);
    const ash = faction.treasuryAsh ?? 0;
    const affordable = ash >= WAR_STAKE_ASH;
    const levelOk = (faction.level ?? 1) >= WAR_MIN_LEVEL;

    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[#ff5a48]" />
                    <span className="text-sm font-bold text-[#E5E7EB]">{t("g.war.declare")}</span>
                </div>

                <p className="text-[11px] text-[#8B8F98]">
                    {t("g.war.declareHint", { stake: WAR_STAKE_ASH.toLocaleString(), level: WAR_MIN_LEVEL })}
                </p>

                {!canDeclare ? (
                    <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.err.faction.noWarAccess")}</p>
                ) : !levelOk ? (
                    <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.err.faction.warLevelTooLow")}</p>
                ) : !affordable ? (
                    <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.err.faction.treasuryShort")}</p>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-black/40 border border-white/10 rounded px-2 py-1.5">
                                <Search className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                                <input
                                    type="text"
                                    value={query}
                                    maxLength={40}
                                    placeholder={t("g.war.searchPlaceholder")}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && query.trim()) onSearchFactions(undefined, query.trim());
                                    }}
                                    className="flex-1 min-w-0 bg-transparent text-[11px] text-[#E5E7EB] outline-none"
                                />
                            </div>
                            <button
                                onClick={() => query.trim() && onSearchFactions(undefined, query.trim())}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded px-3 py-1.5 text-[11px] font-bold text-[#E5E7EB] transition-colors flex-shrink-0"
                            >
                                {t("g.war.search")}
                            </button>
                        </div>

                        {targets.length === 0 ? (
                            <p className="text-[#8B8F98] text-xs text-center py-3">{t("g.war.noTargets")}</p>
                        ) : (
                            <div className="space-y-1 max-h-56 overflow-y-auto">
                                {targets.map((target) => {
                                    const ready = confirming === target.id;
                                    const eligible = (target.level ?? 1) >= WAR_MIN_LEVEL;

                                    return (
                                        <div
                                            key={target.id}
                                            className="flex items-center justify-between gap-2 bg-black/25 border border-white/5 rounded-lg px-2.5 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-[#E5E7EB] truncate">{target.name}</div>
                                                <div className="text-[10px] text-[#6B7280]">
                                                    {t("g.war.targetLevel", { n: target.level ?? 1 })}
                                                </div>
                                            </div>

                                            <button
                                                disabled={!eligible}
                                                onClick={() => (ready ? onDeclareWar(faction.id, target.id) : setConfirming(target.id))}
                                                className={`rounded px-2.5 py-1.5 text-[10px] font-bold border transition-colors flex-shrink-0 ${!eligible
                                                    ? "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                                                    : ready
                                                        ? "bg-[#ff5a48]/25 border-[#ff5a48]/50 text-[#ffb3ab]"
                                                        : "bg-white/5 hover:bg-white/10 border-white/10 text-[#E5E7EB]"
                                                    }`}
                                            >
                                                {ready ? t("g.war.confirm") : t("g.war.attack")}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
